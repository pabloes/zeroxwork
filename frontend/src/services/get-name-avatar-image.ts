/**
 * Avatar picture for a person, in order of preference:
 *
 *   1. an avatar they uploaded on /account (served by our own image service)
 *   2. their Decentraland avatar, when their default name is a *.dcl.* name
 *   3. the Base mark, when their default name is a *.base.* name
 *   4. a locally generated SVG (initials or an identicon), stable per person
 *
 * Step 4 is why this never returns undefined: a missing avatar used to render as
 * a broken image. Nothing here talks to a third-party avatar host (no Gravatar
 * and no friends), because the privacy policy does not cover them.
 */

/** Official Base mark, inlined so *.base.* names need no network request. */
const BASE_AVATAR = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwMCIgaGVpZ2h0PSIzMDAwIiB2aWV3Qm94PSIwIDAgMzAwMCAzMDAwIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxnIGNsaXAtcGF0aD0idXJsKCNjbGlwMF81NTY5XzcyODA5KSI+PHJlY3Qgd2lkdGg9IjMwMDAiIGhlaWdodD0iMzAwMCIgZmlsbD0iIzE1NURGRCIvPjxjaXJjbGUgY3g9IjE1MDAiIGN5PSIxNTAwIiByPSIxNTAwIiBmaWxsPSIjMTU1REZEIi8+PHBhdGggZD0iTTIxODguMTIgMTEzMS45NUMyNjkxLjExIDU5MS4xODcgMjM1Ni44IDI1Ni45NCAxODE1LjkxIDc1OS44MjZDMTc2Ny41NyA4MDQuODI2IDE3MzcuNTYgODY2LjQ5NCAxNzMzLjMyIDkzMi40MDNDMTczMy4zMiA5MzMuNzY3IDE3MzMuMTcgOTM0Ljk3OSAxNzMzLjAyIDkzNi4zNDNDMTcyMi41NiAxMDk0LjY4IDE4NTMuMzUgMTIyNS40NCAyMDExLjcyIDEyMTQuOThDMjAxMy4wOCAxMjE0Ljk4IDIwMTQuMjkgMTIxNC44MyAyMDE1LjY2IDEyMTQuNjhDMjA4MS41OCAxMjEwLjQ0IDIxNDMuMjYgMTE4MC40NCAyMTg4LjI3IDExMzIuMUwyMTg4LjEyIDExMzEuOTVaIiBmaWxsPSJ3aGl0ZSIvPjxwYXRoIGQ9Ik03NTkuODc5IDE4MTYuMDVDMjU2Ljg4NSAyMzU2LjgxIDU5MS4yMDQgMjY5MS4wNiAxMTMyLjA4IDIxODguMTdDMTE4MC40MyAyMTQzLjE3IDEyMTAuNDQgMjA4MS41MSAxMjE0LjY4IDIwMTUuNkMxMjE0LjY4IDIwMTQuMjMgMTIxNC44MyAyMDEzLjAyIDEyMTQuOTggMjAxMS42NkMxMjI1LjQ0IDE4NTMuMzIgMTA5NC42NSAxNzIyLjU2IDkzNi4yODMgMTczMy4wMkM5MzQuOTE5IDE3MzMuMDIgOTMzLjcwNiAxNzMzLjE3IDkzMi4zNDIgMTczMy4zMkM4NjYuNDE4IDE3MzcuNTYgODA0LjczOCAxNzY3LjU2IDc1OS43MjcgMTgxNS45TDc1OS44NzkgMTgxNi4wNVoiIGZpbGw9IndoaXRlIi8+PHBhdGggZD0iTTExMzEuOTYgNzU5LjkyMkM1OTEuMjQ3IDI1Ni44MjYgMjU2Ljg4MSA1OTEuMjY0IDc1OS44NjkgMTEzMi4wOUM4MDQuODY1IDExODAuNDMgODY2LjUyNyAxMjEwLjQ0IDkzMi40MzEgMTIxNC42OEM5MzMuNzk0IDEyMTQuNjggOTM1LjAwNiAxMjE0LjgzIDkzNi4zNyAxMjE0Ljk4QzEwOTQuNjkgMTIyNS40NCAxMjI1LjQ0IDEwOTQuNjYgMTIxNC45OCA5MzYuMzA5QzEyMTQuOTggOTM0Ljk0NiAxMjE0LjgzIDkzMy43MzMgMTIxNC42OCA5MzIuMzY5QzEyMTAuNDQgODY2LjQ1MiAxMTgwLjQ0IDgwNC43NzcgMTEzMi4xMSA3NTkuNzcxTDExMzEuOTYgNzU5LjkyMloiIGZpbGw9IndoaXRlIi8+PHBhdGggZD0iTTE4MTYuMDUgMjE4OC4xMkMyMzU2LjgxIDI2OTEuMTEgMjY5MS4wNiAyMzU2LjggMjE4OC4xNyAxODE1LjkxQzIxNDMuMTcgMTc2Ny41NyAyMDgxLjUxIDE3MzcuNTYgMjAxNS42IDE3MzMuMzJDMjAxNC4yMyAxNzMzLjMyIDIwMTMuMDIgMTczMy4xNyAyMDExLjY2IDE3MzMuMDJDMTg1My4zMiAxNzIyLjU2IDE3MjIuNTYgMTg1My4zNSAxNzMzLjAyIDIwMTEuNzJDMTczMy4wMiAyMDEzLjA4IDE3MzMuMTcgMjAxNC4yOSAxNzMzLjMyIDIwMTUuNjZDMTczNy41NiAyMDgxLjU4IDE3NjcuNTYgMjE0My4yNiAxODE1LjkgMjE4OC4yN0wxODE2LjA1IDIxODguMTJaIiBmaWxsPSJ3aGl0ZSIvPjxwYXRoIGQ9Ik0xNzM3LjE4IDcyNy4wMkMxNzEwLjM2IC0xMC4zMzk4IDEyMzcuNjYgLTEwLjMzOTggMTIxMC44NCA3MjcuMDJDMTIwOC40MiA3OTIuODY5IDEyMzAuODQgODU3LjY1OCAxMjc0LjQ4IDkwNy4zMUMxMjc1LjM5IDkwOC4zNyAxMjc2LjE0IDkwOS4yNzggMTI3Ny4wNSA5MTAuMzM4QzEzODEuNTkgMTAyOS42MiAxNTY2LjQzIDEwMjkuNjIgMTY3MC45NyA5MTAuMzM4QzE2NzEuODggOTA5LjI3OCAxNjcyLjYzIDkwOC4zNyAxNjczLjU0IDkwNy4zMUMxNzE3LjE4IDg1Ny44MSAxNzM5LjQ1IDc5My4wMiAxNzM3LjE4IDcyNy4wMloiIGZpbGw9IndoaXRlIi8+PHBhdGggZD0iTTcyNy4wMiAxMjEwLjgyQy0xMC4zMzk4IDEyMzcuNjQgLTEwLjMzOTggMTcxMC4zNCA3MjcuMDIgMTczNy4xNkM3OTIuODY5IDE3MzkuNTggODU3LjY1OCAxNzE3LjE2IDkwNy4zMSAxNjczLjUyQzkwOC4yMTggMTY3Mi42MiA5MDkuMjc4IDE2NzEuODYgOTEwLjMzOCAxNjcwLjk1QzEwMjkuNjIgMTU2Ni40MSAxMDI5LjYyIDEzODEuNTcgOTEwLjMzOCAxMjc3LjAzQzkwOS4yNzggMTI3Ni4xMiA5MDguMzcgMTI3NS4zNyA5MDcuMzEgMTI3NC40NkM4NTcuODEgMTIzMC44MiA3OTMuMDIgMTIwOC41NSA3MjcuMDIgMTIxMC44MloiIGZpbGw9IndoaXRlIi8+PHBhdGggZD0iTTIwNDAuNjkgMTI3NC40OEMyMDM5LjYzIDEyNzUuMzkgMjAzOC43MiAxMjc2LjE0IDIwMzcuNjYgMTI3Ny4wNUMxOTE4LjM4IDEzODEuNTkgMTkxOC4zOCAxNTY2LjQzIDIwMzcuNjYgMTY3MC45N0MyMDM4LjcyIDE2NzEuODggMjAzOS42MyAxNjcyLjYzIDIwNDAuNjkgMTY3My41NEMyMDkwLjE5IDE3MTcuMTggMjE1NC45OCAxNzM5LjQ1IDIyMjAuOTggMTczNy4xOEMyOTU4LjM0IDE3MTAuMzYgMjk1OC4zNCAxMjM3LjY2IDIyMjAuOTggMTIxMC44NEMyMTU1LjEzIDEyMDguNDIgMjA5MC4zNCAxMjMwLjg0IDIwNDAuNjkgMTI3NC40OFoiIGZpbGw9IndoaXRlIi8+PHBhdGggZD0iTTEyMTAuODIgMjIyMC45OEMxMjM3LjY0IDI5NTguMzQgMTcxMC4zNCAyOTU4LjM0IDE3MzcuMTYgMjIyMC45OEMxNzM5LjU4IDIxNTUuMTMgMTcxNy4xNiAyMDkwLjM0IDE2NzMuNTIgMjA0MC42OUMxNjcyLjYyIDIwMzkuNjMgMTY3MS44NiAyMDM4LjcyIDE2NzAuOTUgMjAzNy42NkMxNTY2LjQxIDE5MTguMzggMTM4MS41NyAxOTE4LjM4IDEyNzcuMDMgMjAzNy42NkMxMjc2LjEyIDIwMzguNzIgMTI3NS4zNyAyMDM5LjYzIDEyNzQuNDYgMjA0MC42OUMxMjMwLjgyIDIwOTAuMTkgMTIwOC41NSAyMTU0Ljk4IDEyMTAuODIgMjIyMC45OFoiIGZpbGw9IndoaXRlIi8+PGNpcmNsZSBjeD0iMTQ3NC41IiBjeT0iMTQ3NC41IiByPSI4ODYuNSIgZmlsbD0id2hpdGUiLz48cGF0aCBkPSJNMTM5MS4wNiAxNTAwQzEzOTEuMDYgMTM1Mi4xMSAxMzU4LjQgMTIxOC4zOCAxMzA1Ljc0IDExMjEuNzJDMTI1My4wMyAxMDI0Ljk1IDExODAuNjkgOTY2IDExMDEuNTMgOTY2QzEwMjIuMzYgOTY2IDk1MC4wMzEgMTAyNC45NSA4OTcuMzE0IDExMjEuNzJDODQ0LjY2IDEyMTguMzggODEyIDEzNTIuMTEgODEyIDE1MDBDODEyIDE2NDcuODkgODQ0LjY2IDE3ODEuNjIgODk3LjMxNCAxODc4LjI4Qzk1MC4wMzEgMTk3NS4wNSAxMDIyLjM2IDIwMzQgMTEwMS41MyAyMDM0QzExODAuNjkgMjAzNCAxMjUzLjAzIDE5NzUuMDUgMTMwNS43NCAxODc4LjI4QzEzNTguNCAxNzgxLjYyIDEzOTEuMDYgMTY0Ny44OSAxMzkxLjA2IDE1MDBaIiBmaWxsPSIjMTU1REZEIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjYiLz48ZWxsaXBzZSBjeD0iMTI2LjQxNCIgY3k9IjIzMS45MzQiIHJ4PSIxMjYuNDE0IiByeT0iMjMxLjkzNCIgdHJhbnNmb3JtPSJtYXRyaXgoMSAwIDAgLTEgOTc2LjE2IDIwMzcpIiBmaWxsPSJ3aGl0ZSIvPjxwYXRoIGQ9Ik0yMTg3LjE2IDE1MDBDMjE4Ny4xNiAxMzUyLjExIDIxNTQuNSAxMjE4LjM4IDIxMDEuODQgMTEyMS43MkMyMDQ5LjEyIDEwMjQuOTUgMTk3Ni43OSA5NjYgMTg5Ny42MyA5NjZDMTgxOC40NiA5NjYgMTc0Ni4xMyAxMDI0Ljk1IDE2OTMuNDEgMTEyMS43MkMxNjQwLjc2IDEyMTguMzggMTYwOC4xIDEzNTIuMTEgMTYwOC4xIDE1MDBDMTYwOC4xIDE2NDcuODkgMTY0MC43NiAxNzgxLjYyIDE2OTMuNDEgMTg3OC4yOEMxNzQ2LjEzIDE5NzUuMDUgMTgxOC40NiAyMDM0IDE4OTcuNjMgMjAzNEMxOTc2Ljc5IDIwMzQgMjA0OS4xMiAxOTc1LjA1IDIxMDEuODQgMTg3OC4yOEMyMTU0LjUgMTc4MS42MiAyMTg3LjE2IDE2NDcuODkgMjE4Ny4xNiAxNTAwWiIgZmlsbD0iIzE1NURGRCIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSI2Ii8+PGVsbGlwc2UgY3g9IjEyNi40MTQiIGN5PSIyMzEuOTM0IiByeD0iMTI2LjQxNCIgcnk9IjIzMS45MzQiIHRyYW5zZm9ybT0ibWF0cml4KDEgMCAwIC0xIDE3NzAuMTcgMjAzNykiIGZpbGw9IndoaXRlIi8+PC9nPjxkZWZzPjxjbGlwUGF0aCBpZD0iY2xpcDBfNTU2OV83MjgwOSI+PHJlY3Qgd2lkdGg9IjMwMDAiIGhlaWdodD0iMzAwMCIgZmlsbD0id2hpdGUiLz48L2NsaXBQYXRoPjwvZGVmcz48L3N2Zz4=';

/** Brand hues from theme.scss; both themes show the avatar on its own fill. */
const AVATAR_COLORS = [
    ['#EF4D42', '#7A1F19'], // red
    ['#EF8D28', '#7A4208'], // orange
    ['#2F9CFB', '#0B3F6E'], // blue
    ['#47C8D6', '#0E4D55'], // cyan
    ['#55F0B7', '#0D5B40'], // mint
    ['#9B7BF0', '#352066'], // violet
];

/** Stable 32-bit hash (FNV-1a); same seed always gives the same avatar. */
function hashSeed(seed: string): number {
    let hash = 0x811c9dc5;
    for (let i = 0; i < seed.length; i++) {
        hash ^= seed.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
}

/** Up to two initials from a human-ish name, or '' when there is nothing to use. */
function initialsOf(name?: string | null): string {
    if (!name) return '';
    const cleaned = name.trim();
    // Wallet addresses and 'Anonymous' are not names: those get an identicon.
    if (!cleaned || /^0x[0-9a-fA-F]{6,}$/.test(cleaned) || cleaned.toLowerCase() === 'anonymous') return '';
    const words = cleaned
        // pablo.dcl.eth / pablo.base.eth / pablo.eth are all just "pablo"
        .replace(/\.(dcl|base)?\.?eth$/i, '')
        .split(/[\s._\-|]+/)
        .filter(Boolean);
    if (words.length === 0) return '';
    const first = [...words[0]][0] ?? '';
    const second = words.length > 1 ? ([...words[words.length - 1]][0] ?? '') : '';
    return (first + second).toUpperCase();
}

/** Inline SVG data URI. utf8 (not base64) so non-latin initials survive. */
function svgDataUri(svg: string): string {
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** 5x5 left-right symmetric dot grid, used when there are no initials. */
function identiconCells(hash: number): string {
    let cells = '';
    for (let y = 0; y < 5; y++) {
        for (let x = 0; x < 3; x++) {
            // one bit per half-cell, reused for the mirrored column
            const on = ((hash >>> ((y * 3 + x) % 29)) & 1) === 1;
            if (!on) continue;
            cells += `<rect x="${12 + x * 15}" y="${12 + y * 15}" width="15" height="15"/>`;
            if (x < 2) cells += `<rect x="${12 + (4 - x) * 15}" y="${12 + y * 15}" width="15" height="15"/>`;
        }
    }
    return cells;
}

/**
 * Deterministic avatar for a seed (user id, name or address).
 * Always returns a self-contained data URI.
 */
export function generateAvatarImage(seed: string, name?: string | null): string {
    const hash = hashSeed(seed || 'zeroxwork');
    const [fill, ink] = AVATAR_COLORS[hash % AVATAR_COLORS.length];
    const initials = initialsOf(name);
    const body = initials
        ? `<text x="50" y="50" fill="${ink}" font-family="'Space Grotesk',system-ui,sans-serif"`
          + ` font-size="${initials.length > 1 ? 38 : 46}" font-weight="600" text-anchor="middle"`
          + ` dominant-baseline="central">${escapeXml(initials)}</text>`
        : `<g fill="${ink}" opacity="0.85">${identiconCells(hash)}</g>`;

    return svgDataUri(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100" role="img">`
        + `<rect width="100" height="100" fill="${fill}"/>${body}</svg>`
    );
}

function escapeXml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export interface NameAvatarInput {
    /** Default wallet name; a *.dcl.* or *.base.* name picks those avatars. */
    name?: string | null;
    /** Wallet address behind that name, needed for the Decentraland avatar. */
    address?: string | null;
    /** Avatar the person uploaded on /account; wins over everything else. */
    avatarUrl?: string | null;
    /** Extra seed for the generated fallback, ideally a stable user id. */
    seed?: string | number | null;
}

export const getNameAvatarImage = ({ name, address, avatarUrl, seed }: NameAvatarInput): string => {
    if (avatarUrl) return avatarUrl;
    if (name && name.indexOf('.dcl.') >= 0 && address) return `/api/user/decentraland-avatar/${address}`;
    if (name && name.indexOf('.base.') >= 0) return BASE_AVATAR;
    return generateAvatarImage(String(seed ?? name ?? address ?? 'zeroxwork'), name);
};
