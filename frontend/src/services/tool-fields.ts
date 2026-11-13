/**
 * Las mismas reglas que el servidor aplica a una herramienta, para poder
 * decirlas antes de mandar nada.
 *
 * Es una copia deliberada de `backend/src/config/tool-fields.ts`, igual que
 * pasa con proyectos: el servidor tiene la última palabra y la vuelve a
 * comprobar entera. Esto sólo existe para que nadie rellene un formulario y se
 * entere al pulsar Guardar.
 */

export const SUMMARY_MAX = 300;
export const TITLE_MAX = 200;

export const EMBED_HEIGHT_MIN = 200;
export const EMBED_HEIGHT_MAX = 3000;
export const EMBED_HEIGHT_DEFAULT = 600;

const URL_MAX = 500;

/**
 * Si el destino es algo que estamos dispuestos a poner en un `href` o en un
 * `src`: una ruta de este mismo sitio, o una dirección https. Lo demás no, y
 * `javascript:` es el motivo de que esta función exista.
 */
export function isAllowedHref(input: string): boolean {
    const value = input.trim();
    if (value === '' || value.length > URL_MAX) return false;
    // Relativa al protocolo: el host no es nuestro y no lo avalamos.
    if (value.startsWith('//')) return false;
    if (value.startsWith('/')) return true;
    return /^https:\/\/[^\s]+$/i.test(value);
}

/**
 * Los sitios que se pueden incrustar, que son los mismos que ya aplicaban los
 * artículos con embed. Lo que se mete en un iframe corre dentro de nuestra
 * página, y el sandbox de `iframe-sandbox.ts` sólo da permisos de verdad a
 * estos orígenes: lo demás entraría capado y sin que nadie supiera por qué.
 */
export const EMBED_URL_WHITELIST = [
    '/embeds/',
    'https://pabloes.github.io/',
];

/**
 * Si eso se puede incrustar. Una ruta nuestra no: meter nuestra propia página
 * dentro de un iframe de nuestra página saca la cabecera y el pie dos veces.
 * Y de las direcciones de fuera, sólo las de la lista.
 */
export function isEmbeddable(input: string): boolean {
    const value = input.trim();
    // Una ruta del sitio no, salvo /embeds/, que son piezas sueltas servidas
    // para esto y no la aplicación entera.
    if (value.startsWith('/') && !value.startsWith('/embeds/')) return false;
    return EMBED_URL_WHITELIST.some((prefix) => value.startsWith(prefix));
}

/** La categoría que llevaban las herramientas cuando eran artículos. */
export const TOOL_CATEGORY = 'tool';

/**
 * Si una categoría de artículo es la de las herramientas. Se mira por nombre y
 * no por id porque el id depende de la base, y esto decide qué se ofrece en un
 * formulario, no qué se guarda.
 */
export function isToolCategory(name: string | null | undefined): boolean {
    return (name ?? '').toLowerCase() === TOOL_CATEGORY;
}
