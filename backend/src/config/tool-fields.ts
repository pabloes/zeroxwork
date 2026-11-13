/**
 * Lo que una herramienta tiene y un articulo no: un destino, y si ese destino
 * se abre o se incrusta.
 *
 * Validado en codigo y no en el esquema, igual que en proyectos, para que
 * cambiar lo que se acepta no cueste una migracion.
 */

/** El resumen es una linea de una tarjeta, no un segundo cuerpo. */
export const SUMMARY_MAX = 300;
export const TITLE_MAX = 200;

/** Mas largo que esto no es una direccion, es una equivocacion. */
const URL_MAX = 500;

/**
 * Como se llega a la herramienta.
 *
 * `link` salta al sitio: sirve tanto para una pagina de este mismo repo
 * (/speed-test) como para algo de fuera. `embed` la mete en un iframe dentro de
 * /tools/<slug>, y eso ya no vale para cualquier direccion: lo que se incrusta
 * corre dentro de nuestra pagina.
 */
export const TOOL_MODES = ['link', 'embed'] as const;
export type ToolMode = typeof TOOL_MODES[number];

/**
 * Alto del iframe. El minimo es para que no quede una rendija inutil; el maximo,
 * porque por encima de eso la pagina se vuelve un scroll infinito con una dapp
 * perdida dentro. La de AAVE pide 1000, asi que 600 no podia ser el techo.
 */
export const EMBED_HEIGHT_MIN = 200;
export const EMBED_HEIGHT_MAX = 3000;
export const EMBED_HEIGHT_DEFAULT = 600;

export type ToolErrorCode =
    | 'TITLE_REQUIRED'
    | 'TITLE_LONG'
    | 'SUMMARY_LONG'
    | 'HREF_REQUIRED'
    | 'HREF_INVALID'
    | 'HREF_NOT_EMBEDDABLE'
    | 'MODE_INVALID'
    | 'EMBED_HEIGHT_INVALID';

export const TOOL_ERRORS: Record<ToolErrorCode, string> = {
    TITLE_REQUIRED: 'La herramienta necesita un nombre.',
    TITLE_LONG: `El nombre no puede pasar de ${TITLE_MAX} caracteres.`,
    SUMMARY_LONG: `El resumen no puede pasar de ${SUMMARY_MAX} caracteres.`,
    HREF_REQUIRED: 'Falta decir donde vive la herramienta.',
    HREF_INVALID: 'Eso no es ni una direccion https ni una ruta de este sitio.',
    HREF_NOT_EMBEDDABLE: 'Lo que se incrusta tiene que ser una direccion https completa.',
    MODE_INVALID: 'Una herramienta se abre o se incrusta, no hay mas.',
    EMBED_HEIGHT_INVALID: `El alto tiene que estar entre ${EMBED_HEIGHT_MIN} y ${EMBED_HEIGHT_MAX} pixeles.`,
};

export type ToolResult<T> =
    | { ok: true; value: T }
    | { ok: false; code: ToolErrorCode };

const asText = (input: unknown): string =>
    input === undefined || input === null ? '' : String(input).trim();

/** El nombre, que es ademas de donde sale el slug. */
export function validateTitle(input: unknown): ToolResult<string> {
    const value = asText(input);
    if (value === '') return { ok: false, code: 'TITLE_REQUIRED' };
    if (value.length > TITLE_MAX) return { ok: false, code: 'TITLE_LONG' };
    return { ok: true, value };
}

/** La linea de la tarjeta, o nada. Vacio la borra. */
export function validateSummary(input: unknown): ToolResult<string | null> {
    const value = asText(input);
    if (value === '') return { ok: true, value: null };
    if (value.length > SUMMARY_MAX) return { ok: false, code: 'SUMMARY_LONG' };
    return { ok: true, value };
}

/**
 * Prosa opcional. A diferencia de un proyecto, una herramienta puede no tener
 * ni una palabra: dos de las tres que habia no tenian ninguna, y exigirsela
 * solo conseguiria que alguien escribiera relleno.
 */
export function validateContent(input: unknown): ToolResult<string | null> {
    const value = asText(input);
    return { ok: true, value: value === '' ? null : value };
}

/** `link` o `embed`. Por omision, la que no mete nada en nuestra pagina. */
export function validateMode(input: unknown): ToolResult<ToolMode> {
    const value = asText(input).toLowerCase();
    if (value === '') return { ok: true, value: 'link' };
    if (!(TOOL_MODES as readonly string[]).includes(value)) {
        return { ok: false, code: 'MODE_INVALID' };
    }
    return { ok: true, value: value as ToolMode };
}

/**
 * Donde vive la herramienta.
 *
 * Una ruta de este mismo sitio vale, y de hecho es lo que querian ser dos de
 * las tres primeras: guardaban `https://zeroxwork.com/speed-test`, el dominio
 * incluido, que es una direccion que deja de funcionar el dia que el dominio
 * cambie. Lo que no vale nunca es `javascript:` ni `data:` ni una direccion sin
 * protocolo: todo esto acaba en un `href` o en un `src`.
 */
export function validateHref(input: unknown, mode: ToolMode): ToolResult<string> {
    const value = asText(input);
    if (value === '') return { ok: false, code: 'HREF_REQUIRED' };
    if (value.length > URL_MAX) return { ok: false, code: 'HREF_INVALID' };

    // Relativa al protocolo: el host no es nuestro y no lo avalamos.
    if (value.startsWith('//')) return { ok: false, code: 'HREF_INVALID' };

    const esRuta = value.startsWith('/');
    const esHttps = /^https:\/\/[^\s]+$/i.test(value);

    if (!esRuta && !esHttps) return { ok: false, code: 'HREF_INVALID' };

    // Incrustar una pagina nuestra dentro de otra pagina nuestra no es
    // incrustar, es un espejo: la cabecera y el pie saldrian dos veces.
    if (mode === 'embed' && !esHttps) return { ok: false, code: 'HREF_NOT_EMBEDDABLE' };

    return { ok: true, value };
}

/** El alto del iframe. Solo lo usa `embed`; en `link` no hay nada que medir. */
export function validateEmbedHeight(input: unknown, mode: ToolMode): ToolResult<number | null> {
    if (mode !== 'embed') return { ok: true, value: null };

    const raw = asText(input);
    if (raw === '') return { ok: true, value: EMBED_HEIGHT_DEFAULT };

    const value = Number(raw);
    if (!Number.isInteger(value) || value < EMBED_HEIGHT_MIN || value > EMBED_HEIGHT_MAX) {
        return { ok: false, code: 'EMBED_HEIGHT_INVALID' };
    }
    return { ok: true, value };
}

/**
 * El slug, con una letra por delante.
 *
 * Mismo motivo que en proyectos: un slug que es solo numeros choca con
 * /tools/<id>, que siempre funciona por detras.
 */
export function slugWithLetter(slug: string): string {
    return /^\d+$/.test(slug) ? `t-${slug}` : slug;
}
