/**
 * El sitemap sobre HTTP de verdad, con la base de datos puesta en pie de
 * mentira y detras el comodin de la SPA, que es justo lo que se llevaba la
 * peticion antes de que esta ruta existiera. Si alguien vuelve a montarla
 * tarde, esto se cae.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const INDEX_HTML = path.join(here, '../../frontend/index.html');

const AT = new Date('2026-11-19T22:26:10.000Z');

const articles = [
    {
        slug: 'zeroxcity-comic-contest', lang: 'en', updatedAt: AT, sourceHash: 'hash-1',
        translations: [{ targetLang: 'es', slug: 'zeroxcity-concurso-de-comics', sourceHash: 'hash-1' }],
        published: true, type: 'post',
    },
    {
        slug: 'borrador', lang: 'es', updatedAt: AT, sourceHash: null,
        translations: [], published: false, type: 'post',
    },
    // Un redirector: al abrirlo el navegador se va a otro sitio.
    {
        slug: 'va-a-otro-lado', lang: 'en', updatedAt: AT, sourceHash: null,
        translations: [], published: true, type: 'link',
    },
];

const projects = [
    { slug: 'moneygrass', updatedAt: AT, published: true },
    { slug: 'proyecto-borrador', updatedAt: AT, published: false },
];

const tools = [
    { slug: 'brain-wallet', updatedAt: AT, published: true },
    { slug: 'herramienta-borrador', updatedAt: AT, published: false },
];

/** El `where` de la consulta, aplicado a mano sobre las filas de mentira. */
const pick = (rows: any[], where: any) => rows.filter((row) => {
    if (where?.published !== undefined && row.published !== where.published) return false;
    if (where?.NOT?.type !== undefined && row.type === where.NOT.type) return false;
    return true;
});

let falla = false;

vi.mock('../src/db/index.js', () => ({
    prisma: {
        article: { findMany: async ({ where }: any) => {
            if (falla) throw new Error('la base de datos no esta');
            return pick(articles, where);
        } },
        project: { findMany: async ({ where }: any) => pick(projects, where) },
        tool: { findMany: async ({ where }: any) => pick(tools, where) },
    },
}));

let base = '';
let server: any;
let SITE_URL = '';

beforeAll(async () => {
    const express = (await import('express')).default;
    const { sitemapRoutes } = await import('../src/routes/sitemap.js');
    SITE_URL = (await import('../src/config/site.js')).SITE_URL;

    const app = express();
    app.use(sitemapRoutes());
    // El comodin de server.ts, que es quien se lo llevaba antes.
    app.get('*', (_req, res) => res.sendFile(INDEX_HTML));

    await new Promise<void>((done) => { server = app.listen(0, done); });
    base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(() => server?.close());

const get = async () => {
    const res = await fetch(`${base}/sitemap.xml`);
    return { res, body: await res.text() };
};

describe('/sitemap.xml', () => {
    it('devuelve XML, no la pagina de la SPA', async () => {
        const { res, body } = await get();

        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toMatch(/xml/);
        expect(body).not.toContain('<div id="root">');
        expect(body.startsWith('<?xml')).toBe(true);
    });

    it('lleva la portada, las piezas publicadas y las traducciones vivas', async () => {
        const { body } = await get();

        expect(body).toContain(`<loc>${SITE_URL}/</loc>`);
        expect(body).toContain(`<loc>${SITE_URL}/view-article/zeroxcity-comic-contest</loc>`);
        expect(body).toContain(`<loc>${SITE_URL}/view-article/zeroxcity-concurso-de-comics</loc>`);
        expect(body).toContain(`<loc>${SITE_URL}/portfolio/moneygrass</loc>`);
        expect(body).toContain(`<loc>${SITE_URL}/tools/brain-wallet</loc>`);
    });

    it('no enseña un borrador, que es como se filtra que existe', async () => {
        const { body } = await get();
        expect(body).not.toContain('borrador');
    });

    it('no manda a un buscador a un redirector', async () => {
        const { body } = await get();
        expect(body).not.toContain('va-a-otro-lado');
    });

    it('se puede guardar un rato', async () => {
        const { res } = await get();
        expect(res.headers.get('cache-control')).toMatch(/max-age=\d+/);
    });

    it('si la consulta falla no sirve un indice a medias', async () => {
        const { sitemapRoutes } = await import('../src/routes/sitemap.js');
        const express = (await import('express')).default;

        falla = true;
        const app = express();
        app.use(sitemapRoutes());
        const roto: any = await new Promise((done) => {
            const s = app.listen(0, () => done(s));
        });

        try {
            // Otro proceso de cache: este router todavia no ha armado nada.
            const res = await fetch(`http://127.0.0.1:${roto.address().port}/sitemap.xml`);
            expect(res.status).toBe(503);
            expect(await res.text()).not.toContain('<urlset');
        } finally {
            falla = false;
            roto.close();
        }
    });
});
