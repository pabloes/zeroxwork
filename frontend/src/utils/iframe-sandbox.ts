/**
 * Iframe sandbox policy for article embeds.
 *
 * allow-same-origin is required for real dapps (wallet connectors, localStorage, CORS).
 * This reduces iframe isolation — only safe for trusted embed sources validated server-side.
 * The backend enforces a whitelist (EMBED_URL_WHITELIST in config/embed.ts) before persisting.
 * TODO: restrict sandbox per-origin when untrusted embeds are added.
 */

export const TRUSTED_EMBED_ORIGINS = [
    'https://pabloes.github.io',
];

export function getIframeSandbox(embedUrl: string): string {
    const full = 'allow-scripts allow-same-origin allow-forms allow-popups';
    const restricted = 'allow-scripts';

    // Internal paths are always trusted
    if (embedUrl.startsWith('/')) return full;

    try {
        const origin = new URL(embedUrl).origin;
        if (TRUSTED_EMBED_ORIGINS.includes(origin)) return full;
    } catch { /* invalid URL — restrict */ }

    return restricted;
}
