/**
 * What a project in the portfolio has to show before it is a project: a cover,
 * enough screenshots to get an idea of it, and optionally one video.
 *
 * Only `project` articles are held to this. Posts and tools go through
 * untouched, which is why every check takes `isProject` instead of guessing.
 */

export const SCREENSHOTS_MIN = 3;
export const SCREENSHOTS_MAX = 8;

/** A path or URL longer than this is a mistake, not an image. */
const URL_MAX = 500;

/**
 * Hosts a project video may be embedded from. Kept here rather than in the
 * database so adding one is a code review, not a form field: an embed runs in
 * an iframe on our own page.
 */
export const VIDEO_HOSTS = [
    'youtube.com',
    'youtu.be',
    'vimeo.com',
];

export type MediaErrorCode =
    | 'COVER_REQUIRED'
    | 'SCREENSHOTS_FEW'
    | 'SCREENSHOTS_MANY'
    | 'SCREENSHOT_INVALID'
    | 'VIDEO_URL_INVALID'
    | 'VIDEO_HOST_NOT_ALLOWED';

export type MediaResult<T> =
    | { ok: true; value: T }
    | { ok: false; code: MediaErrorCode };

/**
 * An image reference we are willing to render. Either a path on our own origin
 * (what the image picker hands over) or an https URL. Anything else — above all
 * `javascript:` and `data:` — would end up in an `src` attribute.
 */
function isRenderableImage(value: string): boolean {
    if (value.length === 0 || value.length > URL_MAX) return false;
    if (value.startsWith('//')) return false; // protocol-relative: host is not ours to vouch for
    if (value.startsWith('/')) return true;
    return /^https:\/\/[^\s]+$/i.test(value);
}

/**
 * The screenshot list as it should be stored: trimmed, de-duplicated, in the
 * order the author arranged it. Returns the list untouched when the article is
 * not a project, so nothing is dropped from a post that happens to carry one.
 */
/**
 * `required` is the gallery rule, not the category: a project is held to the
 * three-shot minimum when it is being created, and not when it is being edited
 * or published. The projects that predate the rule were written straight into
 * the database by the portfolio seed, which never went through this check, and
 * refusing their edits would leave them unfixable.
 */
export function normaliseScreenshots(input: unknown, required: boolean): MediaResult<string[]> {
    if (input === undefined || input === null) return { ok: true, value: [] };
    if (!Array.isArray(input)) return { ok: false, code: 'SCREENSHOT_INVALID' };

    const shots: string[] = [];
    for (const entry of input) {
        if (typeof entry !== 'string') return { ok: false, code: 'SCREENSHOT_INVALID' };
        const value = entry.trim();
        if (value === '') continue;
        if (!isRenderableImage(value)) return { ok: false, code: 'SCREENSHOT_INVALID' };
        if (!shots.includes(value)) shots.push(value); // the same shot twice is a slip
    }

    if (shots.length > SCREENSHOTS_MAX) return { ok: false, code: 'SCREENSHOTS_MANY' };
    if (required && shots.length < SCREENSHOTS_MIN) return { ok: false, code: 'SCREENSHOTS_FEW' };

    return { ok: true, value: shots };
}

/** The video link as it should be stored, or null. Empty clears it. */
export function validateVideoUrl(input: unknown): MediaResult<string | null> {
    if (input === undefined || input === null || String(input).trim() === '') {
        return { ok: true, value: null };
    }

    const raw = String(input).trim();
    if (raw.length > URL_MAX) return { ok: false, code: 'VIDEO_URL_INVALID' };

    let url: URL;
    try {
        url = new URL(raw);
    } catch {
        return { ok: false, code: 'VIDEO_URL_INVALID' };
    }

    if (url.protocol !== 'https:') return { ok: false, code: 'VIDEO_URL_INVALID' };

    // Exact host or a subdomain of it, so www.youtube.com and player.vimeo.com
    // pass while youtube.com.example.net does not.
    const host = url.hostname.toLowerCase();
    const allowed = VIDEO_HOSTS.some((base) => host === base || host.endsWith(`.${base}`));
    if (!allowed) return { ok: false, code: 'VIDEO_HOST_NOT_ALLOWED' };

    return { ok: true, value: url.toString() };
}

/** The cover. Required for a project, optional for everything else. */
/** `required` as in normaliseScreenshots: the rule binds the alta, not the edit. */
export function validateCover(input: unknown, required: boolean): MediaResult<string | null> {
    const value = input === undefined || input === null ? '' : String(input).trim();

    if (value === '') {
        return required ? { ok: false, code: 'COVER_REQUIRED' } : { ok: true, value: null };
    }
    if (!isRenderableImage(value)) {
        return required ? { ok: false, code: 'COVER_REQUIRED' } : { ok: true, value: null };
    }

    return { ok: true, value };
}

/** Human wording for each code, in English; the frontend has its own per language. */
export const MEDIA_ERRORS: Record<MediaErrorCode, string> = {
    COVER_REQUIRED: 'A project needs a cover image.',
    SCREENSHOTS_FEW: `A project needs at least ${SCREENSHOTS_MIN} screenshots.`,
    SCREENSHOTS_MANY: `A project takes at most ${SCREENSHOTS_MAX} screenshots.`,
    SCREENSHOT_INVALID: 'A screenshot must be an uploaded image or an https URL.',
    VIDEO_URL_INVALID: 'The video link is not a valid https URL.',
    VIDEO_HOST_NOT_ALLOWED: `A project video must be hosted on ${VIDEO_HOSTS.join(', ')}.`,
};
