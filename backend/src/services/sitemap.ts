/**
 * El indice que un buscador pide antes de ponerse a rastrear.
 *
 * El robots.txt lleva desde marzo anunciando /sitemap.xml, pero ahi no habia
 * nada: la peticion caia al comodin de la SPA y Google recibia el index.html
 * donde esperaba XML. Un sitemap que no es XML no es un sitemap roto, es un
 * sitemap que no existe, y mientras tanto el robots.txt prometia uno.
 *
 * Aqui estan las piezas puras -- de filas a direcciones, y de direcciones a
 * XML -- sin express y sin prisma, para poder probarlas sin servidor y sin
 * base de datos. Quien las junta es routes/sitemap.ts.
 *
 * Un articulo tiene una direccion por idioma, asi que las suyas van atadas
 * entre si con xhtml:link: es lo que le dice a un buscador que no son trece
 * paginas parecidas sino la misma contada cinco veces, y a quien busca en su
 * idioma le da la que le toca. Un proyecto y una herramienta tienen una sola
 * direccion, que se cuenta en el idioma del lector sin cambiar de sitio, asi
 * que esas van solas.
 */

import { SITE_URL } from '../config/site.js';

/** El idioma por defecto del sitio: el que se lleva el x-default. */
export const DEFAULT_LANG = 'en';

/**
 * Las paginas que estan siempre ahi.
 *
 * Solo las que un desconocido puede abrir y tienen algo que leer. Fuera se
 * quedan las del robots.txt (/admin, /account, /my-*, /create-*, /edit-*), las
 * de un solo uso (/verify, /reset-password, /confirm-email), las de entrar y
 * registrarse, y /eth-brain-wallet, que es la misma pagina que /brain-wallet
 * con otro nombre y solo serviria para competir consigo misma.
 *
 * Las fichas de los miembros tampoco estan: son paginas de personas, y que
 * aparezcan en un buscador es decision de cada una, no del sitemap.
 */
export const STATIC_PATHS = [
    '/',
    '/blog',
    '/portfolio',
    '/tools',
    '/members',
    '/brain-wallet',
    '/speed-test',
    '/terms',
    '/privacy',
];

/** La misma direccion en otro idioma. */
export interface SitemapAlternate {
    /** Como lo escribe hreflang: en, es, fr, zh, pt-br. */
    lang: string;
    url: string;
}

/** Una direccion del sitemap. */
export interface SitemapEntry {
    url: string;
    lastmod?: Date | null;
    /** Vacio en una pagina que no cambia de direccion segun el idioma. */
    alternates?: SitemapAlternate[];
}

/** Una pieza con una direccion por idioma, como la devuelve la consulta. */
export interface TranslatableRow {
    slug: string;
    lang: string;
    updatedAt?: Date | null;
    sourceHash?: string | null;
    translations?: { targetLang: string; slug: string; sourceHash?: string | null }[];
}

/** Una pieza con una sola direccion. */
export interface PlainRow {
    slug: string;
    updatedAt?: Date | null;
}

/** Lo que no puede ir suelto dentro de XML. */
export function escapeXml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/** Una ruta nuestra escrita entera. */
export const siteUrl = (path: string) => `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;

/**
 * Las direcciones de un articulo: la suya y la de cada traduccion.
 *
 * Una traduccion solo cuenta mientras su sourceHash siga siendo el del
 * articulo, que es la misma regla que aplican la pagina y la previsualizacion.
 * Si el articulo cambio despues de traducirse, esa direccion enseña el
 * original, y anunciarla como la version en frances seria mandar a un lector
 * frances a un texto en ingles.
 */
export function articleEntries(articles: TranslatableRow[]): SitemapEntry[] {
    const entries: SitemapEntry[] = [];

    for (const article of articles) {
        const alive = (article.translations ?? [])
            .filter((t) => (t.sourceHash ?? null) === (article.sourceHash ?? null));

        const alternates: SitemapAlternate[] = [
            { lang: article.lang.toLowerCase(), url: siteUrl(`/view-article/${article.slug}`) },
            ...alive.map((t) => ({
                lang: t.targetLang.toLowerCase(),
                url: siteUrl(`/view-article/${t.slug}`),
            })),
        ];

        // Una sola version no necesita que le expliquen que es la unica.
        const linked = alternates.length > 1 ? alternates : undefined;

        for (const one of alternates) {
            entries.push({ url: one.url, lastmod: article.updatedAt ?? null, alternates: linked });
        }
    }

    return entries;
}

/** Las direcciones de algo que vive en un solo sitio. */
export function plainEntries(prefix: string, rows: PlainRow[]): SitemapEntry[] {
    return rows.map((row) => ({
        url: siteUrl(`${prefix}/${row.slug}`),
        lastmod: row.updatedAt ?? null,
    }));
}

/** Las paginas de siempre, que no cambian de direccion ni llevan fecha. */
export function staticEntries(paths: string[] = STATIC_PATHS): SitemapEntry[] {
    return paths.map((path) => ({ url: siteUrl(path) }));
}

/**
 * De cada grupo de alternativas, la que un buscador enseña a quien no encaja
 * en ninguna: la inglesa si la hay, y si no la primera, que es la original.
 */
function xDefault(alternates: SitemapAlternate[]): SitemapAlternate {
    return alternates.find((a) => a.lang === DEFAULT_LANG) ?? alternates[0];
}

const alternateTag = (lang: string, url: string) =>
    `    <xhtml:link rel="alternate" hreflang="${escapeXml(lang)}" href="${escapeXml(url)}"/>`;

/**
 * El XML entero.
 *
 * El formato admite 50.000 direcciones por fichero; de pasar de ahi habria que
 * partirlo en varios y escribir un indice, pero para eso este sitio tendria
 * que crecer tres ordenes de magnitud.
 */
export function buildSitemap(entries: SitemapEntry[]): string {
    const urls = entries.map((entry) => {
        const lines = [`    <loc>${escapeXml(entry.url)}</loc>`];

        if (entry.lastmod) lines.push(`    <lastmod>${entry.lastmod.toISOString()}</lastmod>`);

        if (entry.alternates && entry.alternates.length > 1) {
            for (const one of entry.alternates) lines.push(alternateTag(one.lang, one.url));
            lines.push(alternateTag('x-default', xDefault(entry.alternates).url));
        }

        return `  <url>\n${lines.join('\n')}\n  </url>`;
    });

    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
        '        xmlns:xhtml="http://www.w3.org/1999/xhtml">',
        ...urls,
        '</urlset>',
        '',
    ].join('\n');
}
