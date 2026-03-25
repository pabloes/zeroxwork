/**
 * Embed URL whitelist and validation.
 * Used by blog routes to validate embedUrl before persisting.
 */

export const EMBED_URL_WHITELIST = [
    '/embeds/',                       // internal embeds
    'https://pabloes.github.io/',     // Pablo's GitHub Pages tools
];

export function isEmbedUrlAllowed(url: string): boolean {
    return EMBED_URL_WHITELIST.some(prefix => url.startsWith(prefix));
}
