/**
 * Lo que un rastreador lee de una pagina antes de que React exista.
 *
 * La SPA reescribe el titulo ya en el navegador, asi que todo el que pide
 * /view-article/<slug> sin ejecutar javascript -- X, Discord, WhatsApp,
 * Telegram, Slack -- recibia el index.html con las etiquetas de la portada:
 * el logo y el lema, da igual el articulo. Aqui estan las piezas puras que
 * convierten una fila de la base de datos en las etiquetas de esa pieza, y el
 * reemplazo sobre la plantilla. Nada de esto toca express ni prisma, para que
 * se pueda leer y probar sin servidor y sin base de datos.
 */

import { SITE_URL, absoluteUrl } from '../config/site.js';

/** El logo, para una pieza que no trae imagen propia. */
export const FALLBACK_IMAGE = `${SITE_URL}/zeroxwork-logo.png`;

/**
 * Lo que caben en una previsualizacion. X corta cerca de los 200 y Discord no
 * mucho mas alla, asi que mandar el parrafo entero solo sirve para que lo
 * recorte otro por donde no toca.
 */
export const DESCRIPTION_MAX = 200;

/** Las etiquetas de una pieza. Una descripcion vacia deja la generica en pie. */
export interface SocialMeta {
    title: string;
    description: string;
    /** Absoluta siempre: un rastreador no resuelve rutas relativas. */
    image: string;
    /** Absoluta y canonica: la del slug vigente, no la del que se pidio. */
    url: string;
    type: 'article' | 'website';
    locale?: string;
}

/**
 * El arranque en texto llano del markdown de una pieza.
 *
 * Es el mismo recorte que hace articleExcerpt() en el frontend
 * (frontend/src/services/use-articles.ts) para las tarjetas, con una
 * diferencia a proposito: aqui un titular no cuenta como parrafo. Casi todo
 * articulo empieza repitiendo su titulo en un `#`, y en una tarjeta eso solo
 * queda redundante, pero en una previsualizacion la descripcion saldria
 * palabra por palabra igual que el titulo justo encima. Si todo el cuerpo son
 * titulares, se usa el primero antes que no decir nada.
 */
export function plainExcerpt(markdown: string | null | undefined, maxChars = DESCRIPTION_MAX): string {
    const cleaned = (markdown ?? '')
        .replace(/```[\s\S]*?```/g, ' ')            // bloques de codigo
        .replace(/`([^`]*)`/g, '$1')                // codigo en linea
        .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')       // imagenes
        .replace(/\[([^\]]*)]\([^)]*\)/g, '$1')     // los enlaces se quedan con su texto
        .replace(/\[iframe]/gi, ' ')                // marca de lo que se incrusta
        .replace(/<[^>]+>/g, ' ')                   // html suelto
        .replace(/[*_~]{1,3}/g, '');                // enfasis

    const HEADING = /^\s{0,3}#{1,6}\s+/;

    // Solo un parrafo. Juntar el cuerpo entero arrastra los titulares y la
    // linea del "juegalo aqui" a lo que tendria que leerse como un resumen.
    const blocks = cleaned
        .split(/\n\s*\n/)
        .map((block) => ({
            heading: HEADING.test(block),
            text: block
                .replace(/^\s{0,3}(#{1,6}|>+|[-*+]|\d+\.)\s+/gm, '') // marcas de bloque
                .replace(/\s+/g, ' ')
                .trim(),
        }))
        .filter((block) => block.text !== '');

    const plain = (blocks.find((block) => !block.heading) ?? blocks[0])?.text ?? '';

    if (plain.length <= maxChars) return plain;
    const cut = plain.slice(0, maxChars);
    const lastSpace = cut.lastIndexOf(' ');
    return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * La descripcion de una pieza: su resumen si lo tiene, y si no el arranque del
 * cuerpo. Un proyecto y una herramienta llevan resumen escrito a mano; un
 * articulo no tiene campo donde ponerlo y sale siempre del markdown.
 */
export function metaDescription(
    summary: string | null | undefined,
    body: string | null | undefined,
): string {
    const line = (summary ?? '').trim();
    return plainExcerpt(line !== '' ? line : body, DESCRIPTION_MAX);
}

/** La imagen de la pieza escrita entera, o el logo si no hay ninguna. */
export function socialImage(thumbnail: string | null | undefined): string {
    return absoluteUrl(thumbnail) ?? FALLBACK_IMAGE;
}

/**
 * El idioma como lo escribe OpenGraph: pt-br es pt_BR. Un idioma que no
 * conocemos se deja fuera antes que mandarlo mal.
 */
export function ogLocale(lang: string | null | undefined): string | undefined {
    const wanted = (lang ?? '').trim().toLowerCase();
    const known: Record<string, string> = {
        en: 'en', es: 'es', fr: 'fr', zh: 'zh', 'pt-br': 'pt_BR', pt: 'pt',
    };
    return known[wanted];
}

/** Un valor dentro de un atributo. Un titulo con comillas no rompe la etiqueta. */
const escapeAttr = (value: string) =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

/** La etiqueta que ya esta en la plantilla, o una nueva antes de </head>. */
function upsert(html: string, pattern: RegExp, tag: string): string {
    if (pattern.test(html)) return html.replace(pattern, tag);
    if (html.includes('</head>')) return html.replace('</head>', `  ${tag}\n</head>`);
    return html + tag;
}

const byProperty = (name: string) => new RegExp(`<meta[^>]*\\sproperty=["']${name}["'][^>]*>`, 'i');
const byName = (name: string) => new RegExp(`<meta[^>]*\\sname=["']${name}["'][^>]*>`, 'i');

const property = (html: string, name: string, value: string) =>
    upsert(html, byProperty(name), `<meta property="${name}" content="${escapeAttr(value)}">`);

const named = (html: string, name: string, value: string) =>
    upsert(html, byName(name), `<meta name="${name}" content="${escapeAttr(value)}">`);

/**
 * La plantilla con las etiquetas de esta pieza en lugar de las genericas.
 *
 * Se reemplaza lo que ya hay en el index.html en su sitio y solo se añade lo
 * que falte, para que el orden del head siga siendo el que escribio alguien.
 * Lo que venga vacio se queda sin tocar: mejor la descripcion de la portada
 * que ninguna.
 */
export function injectSocialMeta(html: string, meta: SocialMeta): string {
    let out = html;

    if (meta.title.trim() !== '') {
        const title = escapeAttr(meta.title);
        out = out.replace(/<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`);
        out = property(out, 'og:title', meta.title);
        out = named(out, 'twitter:title', meta.title);
    }

    if (meta.description.trim() !== '') {
        out = named(out, 'description', meta.description);
        out = property(out, 'og:description', meta.description);
        out = named(out, 'twitter:description', meta.description);
    }

    out = property(out, 'og:image', meta.image);
    out = named(out, 'twitter:image', meta.image);
    out = property(out, 'og:url', meta.url);
    out = property(out, 'og:type', meta.type);
    // Con imagen propia o con el logo, la tarjeta es la misma que declara la
    // plantilla; se repite aqui porque es lo que hace que salga la imagen
    // grande y no una miniatura al lado del texto.
    out = named(out, 'twitter:card', 'summary_large_image');

    if (meta.locale) out = property(out, 'og:locale', meta.locale);

    return out;
}
