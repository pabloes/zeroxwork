/**
 * Where the site lives, for the links we hand to somebody who is not on it.
 *
 * Inside a page a relative path is better: it survives a move of the domain and
 * never mixes http with https. In an email, or in the public API, the reader
 * has no page to resolve it against, so the address has to be whole.
 *
 * Overridable by env so a staging copy does not hand out links to the live site.
 */
export const SITE_URL = (process.env.SITE_URL || 'https://zeroxwork.com').replace(/\/+$/, '');

/**
 * A path on our own origin written out whole. An address that is already
 * absolute is left exactly as it is: project covers and screenshots may point
 * at somebody else's host, and rewriting those would break them.
 */
export function absoluteUrl(value: string | null | undefined): string | null {
    if (value === null || value === undefined) return null;
    const trimmed = value.trim();
    if (trimmed === '') return null;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    // Protocol-relative (//host/path) is somebody else's host without saying
    // which scheme; the media validator already refuses it, and so do we.
    if (trimmed.startsWith('//')) return null;
    return `${SITE_URL}/${trimmed.replace(/^\/+/, '')}`;
}
