/**
 * Las piezas del sitemap, sin servidor y sin base de datos. Lo que falta --
 * que la peticion devuelva XML y no el index.html de la SPA -- esta en
 * sitemap-http.test.ts.
 */
import { describe, it, expect } from 'vitest';
import {
    DEFAULT_LANG,
    STATIC_PATHS,
    articleEntries,
    buildSitemap,
    escapeXml,
    plainEntries,
    staticEntries,
} from '../src/services/sitemap.js';
import { SITE_URL } from '../src/config/site.js';

const AT = new Date('2026-11-19T22:26:10.000Z');

/** El concurso: en ingles, con la traduccion española al dia y la francesa no. */
const contest = {
    slug: 'zeroxcity-comic-contest',
    lang: 'en',
    updatedAt: AT,
    sourceHash: 'hash-1',
    translations: [
        { targetLang: 'es', slug: 'zeroxcity-concurso-de-comics', sourceHash: 'hash-1' },
        { targetLang: 'pt-BR', slug: 'zeroxcity-concurso-de-quadrinhos', sourceHash: 'hash-1' },
        { targetLang: 'fr', slug: 'zeroxcity-concours-de-bd', sourceHash: 'hash-viejo' },
    ],
};

/** Uno sin traducir, que es la mayoria. */
const alone = { slug: 'speed-test', lang: 'en', updatedAt: AT, sourceHash: null, translations: [] };

/** Todas las direcciones de un XML, en orden. */
const locs = (xml: string) => [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);

/** Los hreflang de la primera direccion que los lleve. */
function hreflangs(xml: string): Record<string, string> {
    const block = /<url>(?:(?!<\/url>)[\s\S])*hreflang(?:(?!<\/url>)[\s\S])*<\/url>/.exec(xml)?.[0] ?? '';
    const found: Record<string, string> = {};
    for (const m of block.matchAll(/hreflang="([^"]+)"\s+href="([^"]+)"/g)) found[m[1]] = m[2];
    return found;
}

describe('las direcciones de un articulo', () => {
    it('saca una por idioma, y la del articulo entre ellas', () => {
        const urls = articleEntries([contest]).map((e) => e.url);

        expect(urls).toContain(`${SITE_URL}/view-article/zeroxcity-comic-contest`);
        expect(urls).toContain(`${SITE_URL}/view-article/zeroxcity-concurso-de-comics`);
        expect(urls).toContain(`${SITE_URL}/view-article/zeroxcity-concurso-de-quadrinhos`);
    });

    it('deja fuera la traduccion que el articulo dejo atras', () => {
        const urls = articleEntries([contest]).map((e) => e.url);
        expect(urls).not.toContain(`${SITE_URL}/view-article/zeroxcity-concours-de-bd`);
    });

    it('ata entre si las que son la misma pagina', () => {
        const entries = articleEntries([contest]);
        for (const entry of entries) {
            expect(entry.alternates?.map((a) => a.lang).sort()).toEqual(['en', 'es', 'pt-br']);
        }
    });

    it('un articulo sin traducir no lleva alternativas', () => {
        expect(articleEntries([alone])[0].alternates).toBeUndefined();
    });

    it('todas llevan la fecha del articulo', () => {
        for (const entry of articleEntries([contest])) expect(entry.lastmod).toBe(AT);
    });

    it('una traduccion sin hash cuenta si el articulo tampoco lo tiene', () => {
        const sinHash = {
            slug: 'viejo', lang: 'es', updatedAt: AT, sourceHash: null,
            translations: [{ targetLang: 'en', slug: 'old', sourceHash: null }],
        };
        expect(articleEntries([sinHash]).map((e) => e.url))
            .toContain(`${SITE_URL}/view-article/old`);
    });
});

describe('lo que vive en un solo sitio', () => {
    it('sale con su prefijo y su fecha', () => {
        const [entry] = plainEntries('/portfolio', [{ slug: 'moneygrass', updatedAt: AT }]);
        expect(entry.url).toBe(`${SITE_URL}/portfolio/moneygrass`);
        expect(entry.lastmod).toBe(AT);
        expect(entry.alternates).toBeUndefined();
    });
});

describe('las paginas de siempre', () => {
    it('empiezan por la portada y van enteras', () => {
        const urls = staticEntries().map((e) => e.url);
        expect(urls[0]).toBe(`${SITE_URL}/`);
        expect(urls).toHaveLength(STATIC_PATHS.length);
        for (const url of urls) expect(url.startsWith(`${SITE_URL}/`)).toBe(true);
    });

    it('no anuncia nada que el robots.txt prohiba ni ninguna de entrar', () => {
        const urls = staticEntries().map((e) => e.url);
        for (const prohibida of [
            '/admin', '/account', '/my-images', '/my-articles', '/image-upload',
            '/create-article', '/edit-article', '/verify', '/old-brain-wallet',
            '/login', '/register', '/reset-password', '/confirm-email', '/forgot-password',
        ]) {
            expect(urls).not.toContain(`${SITE_URL}${prohibida}`);
        }
    });
});

describe('el XML', () => {
    const xml = buildSitemap([
        ...staticEntries(['/']),
        ...articleEntries([contest]),
        ...plainEntries('/tools', [{ slug: 'brain-wallet', updatedAt: AT }]),
    ]);

    it('declara los dos espacios de nombres que usa', () => {
        expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
        expect(xml).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
        expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
        expect(xml.trimEnd().endsWith('</urlset>')).toBe(true);
    });

    it('escribe cada direccion entera', () => {
        for (const loc of locs(xml)) expect(loc).toMatch(/^https?:\/\/[^/]+\//);
    });

    it('no repite ninguna', () => {
        const all = locs(xml);
        expect(new Set(all).size).toBe(all.length);
    });

    it('la fecha va en el formato que el estandar pide', () => {
        expect(xml).toContain(`<lastmod>${AT.toISOString()}</lastmod>`);
    });

    it('una pagina sin fecha no se la inventa', () => {
        const solo = buildSitemap(staticEntries(['/']));
        expect(solo).not.toContain('<lastmod>');
    });

    it('el x-default es el ingles, que es el idioma por defecto', () => {
        const links = hreflangs(xml);
        expect(links['x-default']).toBe(links[DEFAULT_LANG]);
        expect(links[DEFAULT_LANG]).toBe(`${SITE_URL}/view-article/zeroxcity-comic-contest`);
    });

    it('sin ingles el x-default cae en el original', () => {
        const soloEs = {
            slug: 'articulo', lang: 'es', updatedAt: AT, sourceHash: 'h',
            translations: [{ targetLang: 'fr', slug: 'article', sourceHash: 'h' }],
        };
        const links = hreflangs(buildSitemap(articleEntries([soloEs])));
        expect(links['x-default']).toBe(`${SITE_URL}/view-article/articulo`);
    });

    it('escapa lo que romperia el XML', () => {
        expect(escapeXml('a & b <c> "d"')).toBe('a &amp; b &lt;c&gt; &quot;d&quot;');
        const raro = buildSitemap(plainEntries('/tools', [{ slug: 'a&b', updatedAt: null }]));
        expect(raro).toContain('a&amp;b');
        expect(raro).not.toMatch(/<loc>[^<]*&(?!amp;|lt;|gt;|quot;|apos;)/);
    });
});
