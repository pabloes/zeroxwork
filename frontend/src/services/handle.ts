import { api } from './axios-setup';

/**
 * The address of a member page, /member/<handle>, as the sign-up form deals
 * with it.
 *
 * The rules are the server's (src/config/profile.ts) and this is a copy of
 * them, on purpose: the form has to turn a name into an address on every
 * keystroke and cannot wait for a round trip to do it. Nothing here is
 * trusted -- the server slugs, validates and checks uniqueness again before
 * writing -- so a copy that drifts makes the suggestion worse, never wrong.
 */
export const HANDLE_MIN = 3;
export const HANDLE_MAX = 30;
export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_MAX = 40;

/** `Pablo Estornut` -> `pablo-estornut`. Empty when nothing usable is left. */
export function slugifyHandle(name: string): string {
    return name
        .toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '') // é -> e, so the URL stays ascii
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, HANDLE_MAX)
        .replace(/-+$/g, '');
}

/** Same shape rules as the server, so the form can say why before asking it. */
export function handleShapeError(handle: string): 'HANDLE_LENGTH' | 'HANDLE_INVALID' | null {
    if (handle.length < HANDLE_MIN || handle.length > HANDLE_MAX) return 'HANDLE_LENGTH';
    if (!/^(?=.*[a-z])[a-z0-9]+(-[a-z0-9]+)*$/.test(handle)) return 'HANDLE_INVALID';
    return null;
}

export interface HandleCheck {
    handle: string | null;
    available: boolean;
    /** HANDLE_TAKEN, HANDLE_RESERVED, HANDLE_LENGTH, HANDLE_INVALID or null. */
    code: string | null;
    /** A free handle to offer instead, when the asked-for one is taken. */
    suggestion: string | null;
}

/** Asks whether a handle is free. Public endpoint: there is no account yet. */
export async function checkHandle(handle: string): Promise<HandleCheck> {
    const { data } = await api.get('/user/handle-available', { params: { handle } });
    return data as HandleCheck;
}

export const AVATAR_PX = 512;
const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * A picked file, squared off and shrunk to AVATAR_PX, as a data URL.
 *
 * The avatar travels inside the registration request, because the account that
 * would own an upload does not exist yet. Shrinking it here keeps that request
 * small (a phone photo is several MB, this lands under 100 kB) and costs the
 * new member nothing in quota they did not mean to spend.
 */
export function fileToAvatarDataUrl(file: File): Promise<string> {
    if (!AVATAR_TYPES.includes(file.type)) return Promise.reject(new Error('AVATAR_TYPE'));

    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();

        img.onload = () => {
            URL.revokeObjectURL(url);
            try {
                // Square crop from the middle: an avatar is shown in a circle,
                // and letterboxing one looks like a mistake.
                const side = Math.min(img.naturalWidth, img.naturalHeight);
                const canvas = document.createElement('canvas');
                canvas.width = canvas.height = Math.min(side, AVATAR_PX);
                const ctx = canvas.getContext('2d');
                if (!ctx) return reject(new Error('AVATAR_CANVAS'));

                ctx.drawImage(
                    img,
                    (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side,
                    0, 0, canvas.width, canvas.height,
                );

                // JPEG, not WebP: every browser can write it, and the server
                // sniffs the bytes anyway. An alpha channel is no loss here,
                // the avatar is drawn over a solid disc.
                const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
                if (!dataUrl.startsWith('data:image/jpeg;base64,')) return reject(new Error('AVATAR_CANVAS'));
                resolve(dataUrl);
            } catch (error) {
                reject(error);
            }
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('AVATAR_READ'));
        };

        img.src = url;
    });
}
