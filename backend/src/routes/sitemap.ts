/**
 * /sitemap.xml, que el robots.txt anuncia desde marzo.
 *
 * Se arma al vuelo y se guarda un rato: las filas caben de sobra en memoria y
 * un buscador no pide esto cada minuto, pero tampoco hace falta ir a la base
 * de datos cada vez que a uno le da por mirar. Lo que cambie tarda como mucho
 * el tiempo de la cache en salir aqui, y un articulo recien publicado no se
 * indexa en diez minutos de todas formas.
 *
 * Si la consulta falla no se sirve un sitemap a medias: un buscador se cree lo
 * que lee, y un indice al que le faltan paginas es peor que ninguno, asi que
 * se responde 503 y que vuelva.
 */

import { Router } from 'express';
import { prisma } from '../db/index.js';
import {
    SitemapEntry,
    articleEntries,
    buildSitemap,
    plainEntries,
    staticEntries,
} from '../services/sitemap.js';

/** Lo que dura lo ya armado. */
const TTL_MS = 10 * 60 * 1000;

/**
 * Las piezas publicadas.
 *
 * Un articulo de tipo `link` no es una pagina: al abrirlo el navegador se va a
 * otro sitio, asi que anunciarlo seria mandar a un buscador a un redirector.
 */
async function collect(): Promise<SitemapEntry[]> {
    const [articles, projects, tools] = await Promise.all([
        prisma.article.findMany({
            where: { published: true, NOT: { type: 'link' } },
            select: {
                slug: true, lang: true, updatedAt: true, sourceHash: true,
                translations: { select: { targetLang: true, slug: true, sourceHash: true } },
            },
        }),
        prisma.project.findMany({
            where: { published: true },
            select: { slug: true, updatedAt: true },
        }),
        prisma.tool.findMany({
            where: { published: true },
            select: { slug: true, updatedAt: true },
        }),
    ]);

    return [
        ...staticEntries(),
        ...articleEntries(articles),
        ...plainEntries('/portfolio', projects),
        ...plainEntries('/tools', tools),
    ];
}

export function sitemapRoutes(): Router {
    const router = Router();
    // Dentro, y no en el modulo: dos routers son dos sitios distintos, y uno
    // no tiene por que servir lo que armo el otro.
    let cached: { at: number; xml: string } | null = null;

    router.get('/sitemap.xml', async (_req, res) => {
        try {
            if (!cached || Date.now() - cached.at > TTL_MS) {
                cached = { at: Date.now(), xml: buildSitemap(await collect()) };
            }

            res.type('application/xml')
                .set('Cache-Control', 'public, max-age=3600')
                .send(cached.xml);
        } catch (error: any) {
            console.error('LOG_ sitemap:', error?.message ?? error);
            res.status(503).type('text/plain').send('sitemap unavailable');
        }
    });

    return router;
}

export default sitemapRoutes;
