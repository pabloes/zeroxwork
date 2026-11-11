/**
 * A face for somebody who has not uploaded one.
 *
 * Credits are the most human thing on a project page, and half of them are
 * people without an account here: a row of grey silhouettes makes them look
 * like placeholders rather than the people who did the work. So everybody gets
 * a disc in a brand colour with their initials on it, picked from their name,
 * which means the same person is always the same colour wherever they appear.
 *
 * Drawn as an inline SVG data URI rather than fetched: it costs no request, it
 * cannot 404, and it renders identically in both themes.
 */

/** Background and ink, in pairs that stay readable on each other. */
const DISCS: [string, string][] = [
    ['#EF4D42', '#7A1F19'],
    ['#EF8D28', '#7A4208'],
    ['#2F9CFB', '#0B3F6E'],
    ['#47C8D6', '#0E4D55'],
    ['#55F0B7', '#0D5B40'],
    ['#9B7BF0', '#352066'],
];

/** FNV-1a. Small, stable across reloads, and good enough to spread names. */
function hash(value: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < value.length; i++) {
        h ^= value.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

/**
 * First letter of the first word, plus the first of the last, so "Carlos
 * Muñoz" is CM and "Llacer" is just L. Splits on spaces, dots, underscores
 * and hyphens, which is how handles are written.
 */
export function initials(name: string): string {
    const words = name.trim().split(/[\s._-]+/).filter(Boolean);
    if (words.length === 0) return '?';
    const first = words[0][0] ?? '';
    const last = words.length > 1 ? words[words.length - 1][0] : '';
    return (first + last).toUpperCase();
}

/**
 * A data URI for this person's generated avatar. `seed` is what keeps the
 * colour stable: pass the handle when there is one, so a display name that
 * changes does not repaint them.
 */
export function generatedAvatar(name: string, seed?: string | null): string {
    const [disc, ink] = DISCS[hash(String(seed || name)) % DISCS.length];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">`
        + `<rect width="48" height="48" rx="24" fill="${disc}"/>`
        + `<text x="24" y="31" font-family="Inter,system-ui,sans-serif" font-size="19"`
        + ` font-weight="600" fill="${ink}" text-anchor="middle">${initials(name)}</text>`
        + `</svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** The picture to show for a credit: their own if they uploaded one. */
export function avatarFor(credit: {
    name: string;
    handle?: string | null;
    userId?: number | null;
    avatarUrl?: string | null;
}): string {
    const own = (credit.avatarUrl ?? '').trim();
    if (own !== '') return own;
    return generatedAvatar(credit.name, credit.handle ?? (credit.userId ? String(credit.userId) : null));
}
