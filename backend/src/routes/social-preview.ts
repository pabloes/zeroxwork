/**
 * El index.html con las etiquetas de la pieza que se pide, para que un enlace
 * compartido se vea con su titulo, su resumen y su imagen.
 *
 * Se inyecta para todo el mundo, no solo para rastreadores. Mirar el
 * User-Agent seria mas barato -- una consulta menos por visita -- pero es
 * fragil de una manera que no se nota: cada previsualizador nuevo, o cada vez
 * que uno se cambia el nombre, deja de salir en la lista y el enlace vuelve a
 * compartirse con el logo de la portada sin que nadie se entere, porque quien
 * publica no ve nunca lo que ve el que recibe. Ademas obligaria a un
 * `Vary: User-Agent` delante, que es tanto como no cachear, y servir un HTML
 * distinto a un buscador que a una persona es justo lo que los buscadores
 * llaman cloaking. Lo que cuesta es una consulta indexada por visita a estas
 * tres rutas, y para quien llega con navegador no cambia nada: la SPA reescribe
 * el titulo al montar, igual que hasta ahora.
 *
 * Un borrador y un slug que no existe se comportan igual: se devuelve la
 * pagina tal cual, con las etiquetas de la portada. No se mira la sesion a
 * proposito. Aqui no hay nada que un autor necesite ver -- su propio navegador
 * le pinta la pagina entera -- y mirarla significaria que el HTML de un
 * borrador depende de quien lo pida, que es como se filtra que existe.
 */

import { Router } from 'express';
import fs from 'fs/promises';
import { prisma } from '../db/index.js';
import { SITE_URL } from '../config/site.js';
import {
    DESCRIPTION_MAX,
    SocialMeta,
    injectSocialMeta,
    metaDescription,
    ogLocale,
    plainExcerpt,
    socialImage,
} from '../services/page-meta.js';

/**
 * El idioma de la previsualizacion de un proyecto o una herramienta.
 *
 * Un articulo tiene una direccion por idioma, asi que el slug ya dice en que
 * idioma hay que contarlo. Un proyecto tiene una sola, y el rastreador no pide
 * ninguno en particular, asi que se le cuenta en el idioma por defecto del
 * sitio -- el ingles, el mismo que declara el index.html -- y si no hay
 * traduccion, en el que se escribio.
 */
const PREVIEW_LANG = 'en';

interface Multilingual {
    lang: string;
    summary: string | null;
    content: string | null;
    translations: { targetLang: string; summary: string | null; content: string | null }[];
}

/** El texto de la pieza en ingles si lo hay, y si no como se escribio. */
function preferredText(piece: Multilingual) {
    const translation = piece.lang.toLowerCase() === PREVIEW_LANG
        ? undefined
        : piece.translations.find((t) => t.targetLang.toLowerCase() === PREVIEW_LANG);

    return {
        lang: translation ? translation.targetLang : piece.lang,
        summary: translation?.summary ?? piece.summary,
        content: translation?.content ?? piece.content,
    };
}

/**
 * Un articulo por su slug, por el de una traduccion, por uno viejo del
 * historial o por su id. La resolucion es la misma que hace
 * /api/blog/articles/by-slug: el historial manda, y una traduccion solo cuenta
 * mientras su sourceHash siga siendo el del articulo, porque si no la pagina
 * tampoco la enseña.
 */
async function articleMeta(asked: string): Promise<SocialMeta | null> {
    const numeric = /^\d+$/.test(asked);

    const slugRecord = numeric
        ? null
        : await prisma.articleSlug.findUnique({ where: { slug: asked } });

    const article = slugRecord
        ? await prisma.article.findUnique({ where: { id: slugRecord.articleId } })
        : numeric
            ? await prisma.article.findUnique({ where: { id: Number(asked) } })
            // Un articulo de antes del historial de slugs: la columna sigue ahi.
            : await prisma.article.findUnique({ where: { slug: asked } });

    if (!article || !article.published) return null;

    const lang = slugRecord?.lang ?? article.lang;

    if (lang !== article.lang) {
        const translation = await prisma.articleTranslation.findUnique({
            where: { articleId_targetLang: { articleId: article.id, targetLang: lang } },
        });

        if (translation && translation.sourceHash === article.sourceHash) {
            return {
                title: translation.title,
                description: plainExcerpt(translation.content, DESCRIPTION_MAX),
                image: socialImage(article.thumbnail),
                url: `${SITE_URL}/view-article/${translation.slug}`,
                type: 'article',
                locale: ogLocale(translation.targetLang),
            };
        }
        // Sin traduccion al dia se cae al original, que es lo que se va a leer.
    }

    return {
        title: article.title,
        description: plainExcerpt(article.content, DESCRIPTION_MAX),
        image: socialImage(article.thumbnail),
        url: `${SITE_URL}/view-article/${article.slug}`,
        type: 'article',
        locale: ogLocale(article.lang),
    };
}

/** Un proyecto del portfolio, por slug o por id. */
async function projectMeta(asked: string): Promise<SocialMeta | null> {
    const project = await prisma.project.findUnique({
        where: /^\d+$/.test(asked) ? { id: Number(asked) } : { slug: asked.toLowerCase() },
        select: {
            slug: true, title: true, summary: true, content: true, lang: true,
            thumbnail: true, published: true,
            translations: { select: { targetLang: true, summary: true, content: true } },
        },
    });

    if (!project || !project.published) return null;

    const text = preferredText(project);

    return {
        // El titulo de un proyecto no se traduce: se llama como se llama.
        title: project.title,
        description: metaDescription(text.summary, text.content),
        image: socialImage(project.thumbnail),
        url: `${SITE_URL}/portfolio/${project.slug}`,
        type: 'website',
        locale: ogLocale(text.lang),
    };
}

/** Una ficha del catalogo de herramientas, por slug o por id. */
async function toolMeta(asked: string): Promise<SocialMeta | null> {
    const tool = await prisma.tool.findUnique({
        where: /^\d+$/.test(asked) ? { id: Number(asked) } : { slug: asked.toLowerCase() },
        select: {
            slug: true, title: true, summary: true, content: true, lang: true,
            thumbnail: true, published: true,
            translations: { select: { targetLang: true, summary: true, content: true } },
        },
    });

    if (!tool || !tool.published) return null;

    const text = preferredText(tool);

    return {
        title: tool.title,
        description: metaDescription(text.summary, text.content),
        image: socialImage(tool.thumbnail),
        url: `${SITE_URL}/tools/${tool.slug}`,
        type: 'website',
        locale: ogLocale(text.lang),
    };
}

/**
 * La plantilla, releida solo cuando cambia en disco. Un despliegue reinicia el
 * proceso, pero en local el frontend se reconstruye sin que el backend se
 * entere, y servir un index.html viejo seria servir los assets de antes.
 */
const templates = new Map<string, { mtimeMs: number; html: string }>();

async function readTemplate(indexHtmlPath: string): Promise<string> {
    const { mtimeMs } = await fs.stat(indexHtmlPath);
    const cached = templates.get(indexHtmlPath);
    if (cached && cached.mtimeMs === mtimeMs) return cached.html;

    const html = await fs.readFile(indexHtmlPath, 'utf8');
    templates.set(indexHtmlPath, { mtimeMs, html });
    return html;
}

/**
 * Las tres rutas que tienen pieza detras. Va despues de express.static y antes
 * del comodin: /portfolio/moneygrass.jpg es un fichero de verdad y lo tiene que
 * seguir sirviendo el estatico, y lo que no resuelve aqui sigue su camino al
 * comodin de siempre.
 */
export function socialPreview(indexHtmlPath: string): Router {
    const router = Router();

    const pages: [string, (asked: string) => Promise<SocialMeta | null>][] = [
        ['/view-article/:asked', articleMeta],
        ['/portfolio/:asked', projectMeta],
        ['/tools/:asked', toolMeta],
    ];

    for (const [path, lookup] of pages) {
        router.get(path, async (req, res, next) => {
            try {
                const meta = await lookup(req.params.asked);
                if (!meta) return next();

                const html = await readTemplate(indexHtmlPath);
                res.type('html').send(injectSocialMeta(html, meta));
            } catch (error: any) {
                // Una previsualizacion no vale una pagina rota: si algo falla,
                // sale el fichero tal cual, como salia antes de todo esto.
                console.error('LOG_ social preview:', error?.message ?? error);
                next();
            }
        });
    }

    return router;
}

export default socialPreview;
