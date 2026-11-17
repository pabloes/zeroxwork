/**
 * La previsualizacion sobre HTTP de verdad, con la base de datos puesta en pie
 * de mentira y el index.html de verdad -- frontend/index.html, la misma
 * plantilla que vite copia al dist -- para que una etiqueta que alguien quite
 * de ahi se note aqui y no en X.
 *
 * El montaje imita el de server.ts: el router primero y detras el comodin que
 * manda el fichero tal cual. Lo que se comprueba es justo eso, que una pieza
 * sale con sus etiquetas y que todo lo demas -- un borrador, un slug que no
 * existe -- sigue saliendo como salia.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const INDEX_HTML = path.join(here, '../../frontend/index.html');

/** El concurso: publicado, con cartel, y con una traduccion al dia. */
const contest = {
    id: 12,
    slug: 'zeroxcity-comic-contest',
    title: 'ZEROxCITY Comic Contest',
    content: '# ZEROxCITY Comic Contest\n\nDibuja un comic en ZEROxCITY y llevate el premio.\n\nLas normas, abajo.',
    lang: 'en',
    thumbnail: '/api/images/user-uploaded-images/cartel.jpg',
    published: true,
    sourceHash: 'hash-1',
};

/** Un articulo publicado sin imagen ninguna. */
const plain = {
    id: 13,
    slug: 'sin-imagen',
    title: 'Un articulo sin cartel',
    content: 'Aqui no hay imagen que poner.',
    lang: 'es',
    thumbnail: null,
    published: true,
    sourceHash: 'hash-2',
};

/** Un borrador, que para un desconocido no existe. */
const draft = {
    id: 14,
    slug: 'borrador-secreto',
    title: 'Lo que todavia no se cuenta',
    content: 'Nadie tendria que leer esto.',
    lang: 'es',
    thumbnail: '/api/images/user-uploaded-images/secreto.jpg',
    published: false,
    sourceHash: 'hash-3',
};

const articles: Record<number, any> = { 12: contest, 13: plain, 14: draft };

/** El historial de slugs: el del articulo y el de su traduccion al español. */
const slugs: Record<string, { articleId: number; lang: string }> = {
    'zeroxcity-comic-contest': { articleId: 12, lang: 'en' },
    'zeroxcity-concurso-de-comics': { articleId: 12, lang: 'es' },
    'concurso-viejo': { articleId: 12, lang: 'es' },
    'sin-imagen': { articleId: 13, lang: 'es' },
    'borrador-secreto': { articleId: 14, lang: 'es' },
};

const translations: Record<string, any> = {
    '12:es': {
        articleId: 12,
        targetLang: 'es',
        slug: 'zeroxcity-concurso-de-comics',
        title: 'Concurso de comics ZEROxCITY',
        content: '# Concurso de comics ZEROxCITY\n\nDibuja un comic en ZEROxCITY y llevate el premio.',
        sourceHash: 'hash-1',
    },
    // Traducida y luego el articulo cambio: la pagina la ignora, y nosotros
    // tambien, asi que esta de aqui tiene que caer al original.
    '12:fr': {
        articleId: 12,
        targetLang: 'fr',
        slug: 'zeroxcity-concours-de-bd',
        title: 'Concours de BD ZEROxCITY',
        content: 'Dessine une BD.',
        sourceHash: 'hash-viejo',
    },
};
slugs['zeroxcity-concours-de-bd'] = { articleId: 12, lang: 'fr' };

const moneyGrass = {
    slug: 'money-grass',
    title: 'Money Grass',
    summary: 'Un cómic sobre el dinero que crece.',
    content: '# Money Grass\n\nTexto largo del proyecto.',
    lang: 'es',
    thumbnail: '/api/images/user-uploaded-images/portada.jpg',
    published: true,
    translations: [{ targetLang: 'en', summary: 'A comic about money that grows.', content: 'Long body.' }],
};

const draftProject = { ...moneyGrass, slug: 'proyecto-borrador', title: 'Proyecto borrador', published: false };

const speedTest = {
    slug: 'speed-test',
    title: 'Speed Test',
    summary: 'Mide tu conexion sin salir de la pagina.',
    content: null,
    lang: 'es',
    thumbnail: null,
    published: true,
    translations: [{ targetLang: 'en', summary: 'Measure your connection without leaving the page.', content: null }],
};

vi.mock('../src/db/index.js', () => ({
    prisma: {
        articleSlug: {
            findUnique: async ({ where }: any) => {
                const found = slugs[where.slug];
                return found ? { id: 1, slug: where.slug, createdAt: new Date(), ...found } : null;
            },
        },
        article: {
            findUnique: async ({ where }: any) => {
                if (where.id !== undefined) return articles[where.id] ?? null;
                return Object.values(articles).find((a) => a.slug === where.slug) ?? null;
            },
        },
        articleTranslation: {
            findUnique: async ({ where }: any) => {
                const { articleId, targetLang } = where.articleId_targetLang;
                return translations[`${articleId}:${targetLang}`] ?? null;
            },
        },
        project: {
            findUnique: async ({ where }: any) => {
                if (where.id !== undefined) return where.id === 7 ? moneyGrass : null;
                if (where.slug === moneyGrass.slug) return moneyGrass;
                if (where.slug === draftProject.slug) return draftProject;
                return null;
            },
        },
        tool: {
            findUnique: async ({ where }: any) => (where.slug === speedTest.slug ? speedTest : null),
        },
    },
}));

let base = '';
let server: any;
let SITE_URL = '';
/** La plantilla sin tocar, para comparar contra ella. */
let template = '';

beforeAll(async () => {
    const express = (await import('express')).default;
    const fs = await import('fs/promises');
    const { socialPreview } = await import('../src/routes/social-preview.js');
    SITE_URL = (await import('../src/config/site.js')).SITE_URL;
    template = await fs.readFile(INDEX_HTML, 'utf8');

    const app = express();
    app.use(socialPreview(INDEX_HTML));
    // El comodin de server.ts: lo que no tenga pieza detras sale tal cual.
    app.get('*', (_req, res) => res.sendFile(INDEX_HTML));

    await new Promise<void>((done) => { server = app.listen(0, done); });
    base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(() => server?.close());

/** El contenido de una etiqueta, leido del HTML como lo leeria un rastreador. */
function tag(html: string, selector: string): string | null {
    const [kind, name] = selector.split('|');
    const pattern = new RegExp(`<meta[^>]*\\s${kind}=["']${name}["'][^>]*content=["']([^"']*)["']`, 'i');
    return pattern.exec(html)?.[1] ?? null;
}

const title = (html: string) => /<title>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? null;

async function page(url: string) {
    const res = await fetch(`${base}${url}`);
    return { res, html: await res.text() };
}

describe('un articulo publicado', () => {
    it('sale con su titulo, su resumen, su cartel y su direccion', async () => {
        const { res, html } = await page('/view-article/zeroxcity-comic-contest');

        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toMatch(/text\/html/);

        expect(title(html)).toBe('ZEROxCITY Comic Contest');
        expect(tag(html, 'property|og:title')).toBe('ZEROxCITY Comic Contest');
        expect(tag(html, 'property|og:description'))
            .toBe('Dibuja un comic en ZEROxCITY y llevate el premio.');
        expect(tag(html, 'property|og:image'))
            .toBe(`${SITE_URL}/api/images/user-uploaded-images/cartel.jpg`);
        expect(tag(html, 'property|og:url'))
            .toBe(`${SITE_URL}/view-article/zeroxcity-comic-contest`);
        expect(tag(html, 'property|og:type')).toBe('article');
        expect(tag(html, 'name|twitter:card')).toBe('summary_large_image');
        expect(tag(html, 'name|description'))
            .toBe('Dibuja un comic en ZEROxCITY y llevate el premio.');
    });

    it('la imagen es una direccion entera, que es lo unico que un rastreador sigue', async () => {
        const { html } = await page('/view-article/zeroxcity-comic-contest');
        expect(tag(html, 'property|og:image')).toMatch(/^https:\/\/[^/]+\/.+/);
    });

    it('no deja ni una etiqueta de la portada detras', async () => {
        const { html } = await page('/view-article/zeroxcity-comic-contest');

        expect(html).not.toContain('ZEROxWORK is an online community-cowork');
        expect(tag(html, 'property|og:url')).not.toBe(`${SITE_URL}/`);
        expect(tag(html, 'property|og:image')).not.toBe(`${SITE_URL}/zeroxwork-logo.png`);
    });

    it('la pagina sigue siendo la misma para quien llega con navegador', async () => {
        const { html } = await page('/view-article/zeroxcity-comic-contest');

        expect(html).toContain('<div id="root"></div>');
        expect(html).toContain('src="/src/main.tsx"');
        // Lo unico que cambia es el head: el body entero esta intacto.
        const body = (h: string) => h.slice(h.indexOf('<body>'));
        expect(body(html)).toBe(body(template));
    });

    it('tambien responde por su id, que es la otra direccion que funciona', async () => {
        const { html } = await page('/view-article/12');
        expect(tag(html, 'property|og:title')).toBe('ZEROxCITY Comic Contest');
        // La direccion canonica es la del slug, no la del id con el que se pidio.
        expect(tag(html, 'property|og:url'))
            .toBe(`${SITE_URL}/view-article/zeroxcity-comic-contest`);
    });
});

describe('un articulo sin thumbnail', () => {
    it('cae en el logo de siempre', async () => {
        const { html } = await page('/view-article/sin-imagen');

        expect(tag(html, 'property|og:image')).toBe(`${SITE_URL}/zeroxwork-logo.png`);
        expect(tag(html, 'property|og:title')).toBe('Un articulo sin cartel');
        expect(tag(html, 'name|twitter:card')).toBe('summary_large_image');
    });
});

describe('un slug traducido', () => {
    it('da el titulo y la descripcion en su idioma', async () => {
        const { html } = await page('/view-article/zeroxcity-concurso-de-comics');

        expect(tag(html, 'property|og:title')).toBe('Concurso de comics ZEROxCITY');
        expect(tag(html, 'property|og:description'))
            .toBe('Dibuja un comic en ZEROxCITY y llevate el premio.');
        expect(tag(html, 'property|og:url'))
            .toBe(`${SITE_URL}/view-article/zeroxcity-concurso-de-comics`);
        expect(tag(html, 'property|og:locale')).toBe('es');
        // El cartel es el del articulo: la traduccion no tiene uno propio.
        expect(tag(html, 'property|og:image'))
            .toBe(`${SITE_URL}/api/images/user-uploaded-images/cartel.jpg`);
    });

    it('un slug viejo del historial lleva al vigente, no a ninguna parte', async () => {
        const { html } = await page('/view-article/concurso-viejo');

        expect(tag(html, 'property|og:title')).toBe('Concurso de comics ZEROxCITY');
        expect(tag(html, 'property|og:url'))
            .toBe(`${SITE_URL}/view-article/zeroxcity-concurso-de-comics`);
    });

    it('una traduccion vieja se ignora, igual que la ignora la pagina', async () => {
        const { html } = await page('/view-article/zeroxcity-concours-de-bd');

        expect(tag(html, 'property|og:title')).toBe('ZEROxCITY Comic Contest');
        expect(tag(html, 'property|og:locale')).toBe('en');
    });
});

describe('un borrador', () => {
    it('se comporta igual que algo que nunca estuvo ahi', async () => {
        const { res, html } = await page('/view-article/borrador-secreto');

        expect(res.status).toBe(200);
        expect(html).toBe(template);
        expect(html).not.toContain('Lo que todavia no se cuenta');
        expect(html).not.toContain('secreto.jpg');
    });

    it('y un proyecto borrador tampoco se asoma', async () => {
        const { res, html } = await page('/portfolio/proyecto-borrador');

        expect(res.status).toBe(200);
        expect(html).toBe(template);
        expect(html).not.toContain('Proyecto borrador');
    });
});

describe('un slug que no existe', () => {
    it('devuelve la pagina tal cual, sin romperse', async () => {
        const { res, html } = await page('/view-article/esto-no-existe');

        expect(res.status).toBe(200);
        expect(html).toBe(template);
        expect(title(html)).toContain('ZEROxWORK');
    });

    it('igual en el portfolio y en las herramientas', async () => {
        for (const url of ['/portfolio/nada', '/tools/nada', '/portfolio/9999']) {
            const { res, html } = await page(url);
            expect(res.status).toBe(200);
            expect(html).toBe(template);
        }
    });

    it('y las listas no son piezas: salen como siempre', async () => {
        for (const url of ['/portfolio', '/tools', '/blog', '/']) {
            const { html } = await page(url);
            expect(html).toBe(template);
        }
    });
});

describe('un proyecto y una herramienta', () => {
    it('el proyecto sale con su resumen y su portada', async () => {
        const { html } = await page('/portfolio/money-grass');

        expect(tag(html, 'property|og:title')).toBe('Money Grass');
        // En ingles, que es el idioma por defecto del sitio y el que declara
        // la plantilla: el rastreador no pide ninguno.
        expect(tag(html, 'property|og:description')).toBe('A comic about money that grows.');
        expect(tag(html, 'property|og:locale')).toBe('en');
        expect(tag(html, 'property|og:image'))
            .toBe(`${SITE_URL}/api/images/user-uploaded-images/portada.jpg`);
        expect(tag(html, 'property|og:url')).toBe(`${SITE_URL}/portfolio/money-grass`);
        expect(tag(html, 'property|og:type')).toBe('website');
    });

    it('el proyecto responde tambien por id, con la direccion del slug', async () => {
        const { html } = await page('/portfolio/7');
        expect(tag(html, 'property|og:url')).toBe(`${SITE_URL}/portfolio/money-grass`);
    });

    it('la herramienta sale con su linea, y con el logo si no tiene imagen', async () => {
        const { html } = await page('/tools/speed-test');

        expect(tag(html, 'property|og:title')).toBe('Speed Test');
        expect(tag(html, 'property|og:description'))
            .toBe('Measure your connection without leaving the page.');
        expect(tag(html, 'property|og:image')).toBe(`${SITE_URL}/zeroxwork-logo.png`);
        expect(tag(html, 'property|og:url')).toBe(`${SITE_URL}/tools/speed-test`);
    });

    it('un slug en mayusculas encuentra la pieza, como en la API', async () => {
        const { html } = await page('/portfolio/Money-Grass');
        expect(tag(html, 'property|og:title')).toBe('Money Grass');
    });
});
