/**
 * Public profile validation (display name, handle and avatar URL).
 * Used by the user routes before persisting anything on the users table.
 */

export const DISPLAY_NAME_MAX = 40;
export const DISPLAY_NAME_MIN = 2;

export const HANDLE_MIN = 3;
export const HANDLE_MAX = 30;

/**
 * Handles that would collide with a route or impersonate the site. The member
 * page lives at /member/<handle>, so a collision is not possible today, but a
 * handle is also what shows up in credits and @-mentions and these should not
 * be claimable.
 */
const RESERVED_HANDLES = new Set([
    'admin', 'administrator', 'api', 'root', 'support', 'help', 'staff', 'moderator', 'mod',
    'zeroxwork', 'zerox', '0xwork', 'official', 'team', 'www', 'mail', 'webmaster',
    'me', 'you', 'user', 'users', 'member', 'members', 'account', 'settings', 'profile',
    'login', 'logout', 'register', 'signup', 'signin', 'verify', 'password',
    'blog', 'tools', 'portfolio', 'article', 'articles', 'tag', 'tags', 'category',
    'new', 'create', 'edit', 'delete', 'null', 'undefined', 'anonymous',
]);

/** Avatars may only point at our own image service, never at a third-party host. */
export const AVATAR_URL_PREFIX = '/api/images/user-uploaded-images/';
const AVATAR_URL_PATTERN = /^\/api\/images\/user-uploaded-images\/([0-9a-f]{64})\.[A-Za-z0-9]{1,5}$/;

export type DisplayNameResult =
    | { ok: true; value: string | null }
    | { ok: false; code: 'DISPLAY_NAME_LENGTH' | 'DISPLAY_NAME_INVALID' | 'DISPLAY_NAME_EMAIL' };

/**
 * Normalise a submitted display name.
 * null / "" clears it; anything email-shaped is rejected so the public name can
 * never be (or look like) the account's email address.
 */
export function validateDisplayName(input: unknown): DisplayNameResult {
    if (input === null || input === undefined || String(input).trim() === '') {
        return { ok: true, value: null };
    }

    const name = String(input).replace(/\s+/g, ' ').trim();

    if (name.length < DISPLAY_NAME_MIN || name.length > DISPLAY_NAME_MAX) {
        return { ok: false, code: 'DISPLAY_NAME_LENGTH' };
    }
    // eslint-disable-next-line no-control-regex
    if (/[\u0000-\u001F\u007F<>]/.test(name)) {
        return { ok: false, code: 'DISPLAY_NAME_INVALID' };
    }
    if (/\S+@\S+\.\S+/.test(name)) {
        return { ok: false, code: 'DISPLAY_NAME_EMAIL' };
    }

    return { ok: true, value: name };
}

export type HandleResult =
    | { ok: true; value: string | null }
    | { ok: false; code: 'HANDLE_LENGTH' | 'HANDLE_INVALID' | 'HANDLE_RESERVED' };

/**
 * Normalise a submitted handle. null / "" clears it (the account then has no
 * public page). Lowercased, because the handle is part of a URL and
 * /member/Carlos and /member/carlos must never be two different people.
 */
export function validateHandle(input: unknown): HandleResult {
    if (input === null || input === undefined || String(input).trim() === '') {
        return { ok: true, value: null };
    }

    const handle = String(input).trim().toLowerCase();

    if (handle.length < HANDLE_MIN || handle.length > HANDLE_MAX) {
        return { ok: false, code: 'HANDLE_LENGTH' };
    }
    // Letters, digits and single inner hyphens. No dots or underscores: those
    // read badly in a URL and invite look-alike handles.
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(handle)) {
        return { ok: false, code: 'HANDLE_INVALID' };
    }
    if (RESERVED_HANDLES.has(handle)) {
        return { ok: false, code: 'HANDLE_RESERVED' };
    }

    return { ok: true, value: handle };
}

/**
 * The sha256 of the upload an avatar URL points at, or null when the URL is not
 * one of our own uploaded-image paths.
 */
export function avatarUrlHash(input: unknown): string | null {
    if (input === null || input === undefined) return null;
    const match = AVATAR_URL_PATTERN.exec(String(input).trim());
    return match ? match[1] : null;
}
