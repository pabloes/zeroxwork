/**
 * Public profile validation (display name + avatar URL).
 * Used by the user routes before persisting anything on the users table.
 */

export const DISPLAY_NAME_MAX = 40;
export const DISPLAY_NAME_MIN = 2;

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

/**
 * The sha256 of the upload an avatar URL points at, or null when the URL is not
 * one of our own uploaded-image paths.
 */
export function avatarUrlHash(input: unknown): string | null {
    if (input === null || input === undefined) return null;
    const match = AVATAR_URL_PATTERN.exec(String(input).trim());
    return match ? match[1] : null;
}
