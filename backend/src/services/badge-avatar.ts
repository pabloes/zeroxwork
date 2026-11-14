/**
 * The picture that goes on a member's badge.
 *
 * The badge is one file that somebody else's site loads, so nothing in it may
 * point back at us: an <img> on another domain renders an SVG with external
 * references stripped, and a link to our image service would come out blank.
 * Everything therefore arrives here as bytes and leaves inlined -- either as a
 * data URI or, for the generated avatars, as the shapes themselves.
 *
 * The order of preference is the same one the site uses in
 * frontend/src/services/get-name-avatar-image.ts, so the badge shows the face
 * the member already sees next to their name:
 *
 *   1. the avatar they uploaded on /account
 *   2. their Decentraland avatar, when their default name is a *.dcl.* name
 *   3. a generated one (initials or identicon), stable per account
 *
 * A *.base.* name falls to step 3 rather than carrying the Base mark: that one
 * is an inline SVG on the site, and nesting an SVG inside the badge is the kind
 * of thing some renderers quietly drop.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Where POST /images/upload leaves what it stored. */
const UPLOADS = path.join(__dirname, '../../public/user-uploaded-images');

const DECENTRALAND_PROFILES = 'https://peer.decentraland.org/lambdas/profiles';

/** The avatar is drawn into a circle this wide; twice that for a sharp retina. */
const AVATAR_PX = 192;

/** Nothing on the badge is worth hanging a request on. */
const FETCH_TIMEOUT = 4000;
const FETCH_MAX_BYTES = 4 * 1024 * 1024;

export type BadgeAvatar =
    /** A photograph, already inlined. */
    | { kind: 'photo'; dataUri: string }
    /** Shapes drawn in a 100x100 box, for when there is no photograph. */
    | { kind: 'drawn'; body: string; fill: string };

export interface AvatarSources {
    id: number;
    avatarUrl?: string | null;
    name?: string | null;
    address?: string | null;
}

/** Brand hues from theme.scss, the same list the site generates avatars from. */
const AVATAR_COLORS: Array<[string, string]> = [
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
    if (!cleaned || /^0x[0-9a-fA-F]{6,}$/.test(cleaned) || cleaned.toLowerCase() === 'anonymous') return '';
    const words = cleaned
        .replace(/\.(dcl|base)?\.?eth$/i, '')
        .split(/[\s._\-|]+/)
        .filter(Boolean);
    if (words.length === 0) return '';
    const first = [...words[0]][0] ?? '';
    const second = words.length > 1 ? ([...words[words.length - 1]][0] ?? '') : '';
    return (first + second).toUpperCase();
}

/** 5x5 left-right symmetric dot grid, used when there are no initials. */
function identiconCells(hash: number): string {
    let cells = '';
    for (let y = 0; y < 5; y++) {
        for (let x = 0; x < 3; x++) {
            const on = ((hash >>> ((y * 3 + x) % 29)) & 1) === 1;
            if (!on) continue;
            cells += `<rect x="${12 + x * 15}" y="${12 + y * 15}" width="15" height="15"/>`;
            if (x < 2) cells += `<rect x="${12 + (4 - x) * 15}" y="${12 + y * 15}" width="15" height="15"/>`;
        }
    }
    return cells;
}

export function escapeXml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/** The generated avatar, as shapes in a 100x100 box. Never fails. */
export function drawnAvatar(sources: AvatarSources): BadgeAvatar {
    const seed = String(sources.id ?? sources.name ?? sources.address ?? 'zeroxwork');
    const hash = hashSeed(seed);
    const [fill, ink] = AVATAR_COLORS[hash % AVATAR_COLORS.length];
    const initials = initialsOf(sources.name);

    // The site uses Space Grotesk here; on somebody else's machine the badge
    // will not have it, so the stack falls through to whatever is there.
    const body = initials
        ? `<text x="50" y="50" fill="${ink}" font-family="'Space Grotesk','Helvetica Neue',Arial,sans-serif"`
          + ` font-size="${initials.length > 1 ? 38 : 46}" font-weight="600" text-anchor="middle"`
          + ` dominant-baseline="central">${escapeXml(initials)}</text>`
        : `<g fill="${ink}" opacity="0.85">${identiconCells(hash)}</g>`;

    return { kind: 'drawn', body, fill };
}

/** Bytes to a square JPEG data URI. White behind anything transparent. */
async function inlineSquare(bytes: Buffer): Promise<string | null> {
    try {
        const jpeg = await sharp(bytes)
            // Centre, not the "interesting" crop: the avatar on the site is
            // an object-fit: cover square, and the badge has to be the same face.
            .resize(AVATAR_PX, AVATAR_PX, { fit: 'cover' })
            .flatten({ background: '#ffffff' })
            .jpeg({ quality: 80, progressive: false })
            .toBuffer();
        return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
    } catch (error) {
        console.error('badge: could not read the avatar image', error);
        return null;
    }
}

/** An uploaded avatar, straight off our own disk. */
async function uploadedBytes(avatarUrl: string): Promise<Buffer | null> {
    const match = /\/api\/images\/user-uploaded-images\/([^/?#]+)$/.exec(avatarUrl);
    if (!match) return null;

    // The name comes out of our own database, but it ends up in a path: refuse
    // anything that is not the plain file name it is supposed to be.
    const fileName = decodeURIComponent(match[1]);
    if (fileName === '' || fileName.includes('/') || fileName.includes('\\') || fileName.includes('..')) return null;

    try {
        return await fs.readFile(path.join(UPLOADS, fileName));
    } catch {
        return null; // gone from disk: the generated avatar takes over
    }
}

/** A picture from somewhere else. Only used for the Decentraland snapshot. */
async function fetchedBytes(url: string): Promise<Buffer | null> {
    try {
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: FETCH_TIMEOUT,
            maxContentLength: FETCH_MAX_BYTES,
            maxRedirects: 2,
        });
        return Buffer.from(response.data);
    } catch (error: any) {
        console.error('badge: could not fetch the avatar', url, error?.message ?? error);
        return null;
    }
}

/** The face Decentraland has for an address. */
async function decentralandBytes(address: string): Promise<Buffer | null> {
    try {
        const profile = await axios.post(DECENTRALAND_PROFILES, { ids: [address] }, { timeout: FETCH_TIMEOUT });
        const face = profile.data?.[0]?.avatars?.[0]?.avatar?.snapshots?.face256;
        if (typeof face !== 'string' || !/^https?:\/\//i.test(face)) return null;
        return await fetchedBytes(face);
    } catch (error: any) {
        console.error('badge: no Decentraland avatar for', address, error?.message ?? error);
        return null;
    }
}

/**
 * The avatar for a badge. Always answers: anything that cannot be read falls
 * back to the generated one rather than leaving a hole in the picture.
 */
export async function badgeAvatar(sources: AvatarSources): Promise<BadgeAvatar> {
    const avatarUrl = (sources.avatarUrl ?? '').trim();
    const name = sources.name ?? '';

    let bytes: Buffer | null = null;

    if (avatarUrl !== '') {
        // Only ever off our own disk. PUT /user/profile stores nothing but the
        // path of an upload this account owns, and a badge is not a reason to
        // start fetching whatever address happens to sit in that column: that
        // would be our server opening a URL somebody else chose.
        bytes = await uploadedBytes(avatarUrl);
    } else if (name.includes('.dcl.') && sources.address) {
        bytes = await decentralandBytes(sources.address);
    }

    if (bytes) {
        const dataUri = await inlineSquare(bytes);
        if (dataUri) return { kind: 'photo', dataUri };
    }

    return drawnAvatar(sources);
}
