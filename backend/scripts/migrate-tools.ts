/**
 * Pasa las herramientas del blog a su propia tabla, y despublica lo que el blog
 * ya no tiene por que guardar.
 *
 * Uso:
 *   npx tsx scripts/migrate-tools.ts            # simulacion, no escribe nada
 *   npx tsx scripts/migrate-tools.ts --apply    # lo hace
 *
 * Dos mitades, y la segunda depende de la primera:
 *
 *  1. Cada articulo con categoria "tool" se copia a `tools`. El destino, que
 *     hasta ahora vivia en `redirectUrl` o en `embedUrl` segun el dia, pasa a
 *     ser un campo con nombre: `href` mas `mode`.
 *  2. Un articulo publicado cuyo slug ya existe en `tools` o en `projects` se
 *     despublica. La condicion no es cosmetica: comprueba que el sustituto
 *     existe ANTES de esconder el original. Nada se borra; se puede volver a
 *     publicar desde /admin con un clic.
 *
 * Se puede repetir: empareja por slug y actualiza en vez de duplicar.
 */

import { PrismaClient } from '@prisma/client';
import { EMBED_HEIGHT_DEFAULT } from '../src/config/tool-fields.js';

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');

/**
 * `https://zeroxwork.com/speed-test` es una direccion que deja de funcionar el
 * dia que cambie el dominio, y lo que queria decir era "la pagina /speed-test
 * de este mismo sitio". Eso es lo que se guarda.
 */
const NUESTRO = /^https?:\/\/(www\.)?zeroxwork\.com(\/|$)/i;

function comoDestino(url: string): string {
    if (!NUESTRO.test(url)) return url;
    const ruta = url.replace(NUESTRO, '/').replace(/\/+/g, '/');
    return ruta === '' ? '/' : ruta;
}

/** Que es esta herramienta: algo que se abre, o algo que se incrusta. */
function destinoDe(article: { type: string; redirectUrl: string | null; embedUrl: string | null; embedHeight: number | null }) {
    const embed = (article.embedUrl ?? '').trim();
    if (embed !== '') {
        return { mode: 'embed' as const, href: embed, embedHeight: article.embedHeight ?? EMBED_HEIGHT_DEFAULT };
    }

    const link = (article.redirectUrl ?? '').trim();
    if (link !== '') {
        return { mode: 'link' as const, href: comoDestino(link), embedHeight: null };
    }

    return null;
}

async function main(): Promise<void> {
    const url = new URL(process.env.DATABASE_URL ?? '');
    console.log(`Base: ${url.hostname}:${url.port || 5432}${url.pathname}`);
    console.log(apply ? 'Modo: APLICAR\n' : 'Modo: simulacion (no escribe nada)\n');

    // ---------------------------------------------------- 1. copiar

    const articles = await prisma.article.findMany({
        where: { category: { name: 'tool' } },
        select: {
            id: true, slug: true, title: true, content: true, thumbnail: true,
            type: true, redirectUrl: true, embedUrl: true, embedHeight: true,
            lang: true, published: true, featured: true, userId: true,
            tags: { select: { id: true, name: true } },
        },
        orderBy: { id: 'asc' },
    });

    console.log(`Articulos con categoria "tool": ${articles.length}\n`);

    let creadas = 0;
    let actualizadas = 0;
    const sinDestino: string[] = [];

    for (const article of articles) {
        const destino = destinoDe(article);
        if (!destino) {
            // Sin destino no es una herramienta, es un articulo mal etiquetado.
            // Se queda donde esta y se cuenta al final.
            sinDestino.push(`${article.slug} (#${article.id})`);
            continue;
        }

        const existente = await prisma.tool.findUnique({
            where: { slug: article.slug },
            select: { id: true },
        });

        const datos = {
            title: article.title,
            // El articulo no tenia resumen: ese campo no existia. Queda vacio a
            // proposito, para que se escriba a mano una linea pensada en vez de
            // heredar el primer parrafo recortado de un cuerpo que no hay.
            content: (article.content ?? '').trim() === '' ? null : article.content,
            thumbnail: article.thumbnail,
            href: destino.href,
            mode: destino.mode,
            embedHeight: destino.embedHeight,
            lang: article.lang,
            createdById: article.userId,
        };

        // `published` y `featured` se copian al crear y nunca mas. Pasada la
        // primera vez son de la herramienta, no del articulo: la segunda mitad
        // de este script despublica el articulo de origen, asi que volver a
        // copiarlo de ahi dejaria /tools vacio al repetir. Cuesta dos lineas
        // decirlo y una tarde descubrirlo.
        const alCrear = { published: article.published, featured: article.featured };

        console.log(`- ${article.title}`);
        console.log(`    ${destino.mode === 'embed' ? 'se incrusta' : 'salta a'}: ${destino.href}`);
        if (destino.mode === 'embed') console.log(`    alto: ${destino.embedHeight}px`);
        console.log(`    etiquetas: ${article.tags.map((t) => t.name).join(', ') || 'ninguna'}`);
        console.log(`    texto: ${datos.content ? `${datos.content.length} caracteres` : 'ninguno'}`);

        if (!apply) {
            console.log(`    -> ${existente ? 'se actualizaria' : 'se crearia'} /tools/${article.slug}`);
            existente ? actualizadas++ : creadas++;
            continue;
        }

        if (existente) {
            await prisma.tool.update({
                where: { id: existente.id },
                data: { ...datos, tags: { set: article.tags.map((t) => ({ id: t.id })) } },
            });
            actualizadas++;
            console.log(`    -> actualizada /tools/${article.slug}`);
        } else {
            await prisma.tool.create({
                data: {
                    ...datos,
                    ...alCrear,
                    slug: article.slug,
                    tags: { connect: article.tags.map((t) => ({ id: t.id })) },
                },
            });
            creadas++;
            console.log(`    -> creada /tools/${article.slug}`);
        }
    }

    console.log(`\nHerramientas: ${creadas} nuevas, ${actualizadas} actualizadas.`);
    if (sinDestino.length > 0) {
        console.log(`Sin destino, no se tocan: ${sinDestino.join(', ')}`);
    }

    // ------------------------------------- 2. despublicar lo superado

    console.log('\nArticulos publicados que ya viven en otro sitio:');

    const publicados = await prisma.article.findMany({
        where: { published: true },
        select: { id: true, slug: true, title: true },
        orderBy: { id: 'asc' },
    });

    const superados: { id: number; title: string; donde: string }[] = [];

    for (const article of publicados) {
        const [tool, project] = await Promise.all([
            prisma.tool.findUnique({ where: { slug: article.slug }, select: { id: true } }),
            prisma.project.findUnique({ where: { slug: article.slug }, select: { id: true } }),
        ]);

        if (tool) superados.push({ id: article.id, title: article.title, donde: `/tools/${article.slug}` });
        else if (project) superados.push({ id: article.id, title: article.title, donde: `/portfolio/${article.slug}` });
    }

    if (superados.length === 0) {
        console.log('  ninguno');
    } else {
        for (const uno of superados) {
            console.log(`  - "${uno.title}" ya esta en ${uno.donde}`);
        }

        if (apply) {
            const { count } = await prisma.article.updateMany({
                where: { id: { in: superados.map((s) => s.id) } },
                data: { published: false },
            });
            console.log(`\n  ${count} despublicados. Siguen en la base; se vuelven a publicar desde /admin.`);
        } else {
            console.log(`\n  ${superados.length} se despublicarian. No se borra ninguno.`);
        }
    }

    if (!apply) {
        console.log('\nSimulacion: no se ha escrito nada. Repite con --apply.');
    }
}

main()
    .catch((error) => {
        console.error('\nHa fallado:', error instanceof Error ? error.message : error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
