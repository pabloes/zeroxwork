/**
 * The media a project carries: a cover, three to eight screenshots, and one
 * optional video. The same numbers and the same host list as the backend, which
 * has the last word -- these are here so the form can say what is missing
 * before anyone presses save.
 */

export const SCREENSHOTS_MIN = 3;
export const SCREENSHOTS_MAX = 8;

/** Mirrors VIDEO_HOSTS in backend/src/config/project-media.ts. */
export const VIDEO_HOSTS = ['youtube.com', 'youtu.be', 'vimeo.com'];

/** The category whose articles are projects, as the API names it. */
export const PROJECT_CATEGORY = 'project';

/** Whether a video link will be accepted. Empty counts as fine: it is optional. */
export function isAllowedVideoUrl(input: string): boolean {
    const raw = input.trim();
    if (raw === '') return true;

    try {
        const url = new URL(raw);
        if (url.protocol !== 'https:') return false;
        const host = url.hostname.toLowerCase();
        return VIDEO_HOSTS.some((base) => host === base || host.endsWith(`.${base}`));
    } catch {
        return false;
    }
}

/**
 * The URL to put in an iframe for a watch page, or null when the link is not
 * one we know how to embed. Returning null is what makes the page fall back to
 * a plain link instead of an empty black box.
 */
export function videoEmbedUrl(input: string | null | undefined): string | null {
    if (!input) return null;

    let url: URL;
    try {
        url = new URL(input.trim());
    } catch {
        return null;
    }
    if (url.protocol !== 'https:') return null;

    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    const path = url.pathname.replace(/\/+$/, '');

    // youtu.be/<id>
    if (host === 'youtu.be') {
        const id = path.slice(1);
        return /^[\w-]{6,}$/.test(id) ? `https://www.youtube.com/embed/${id}` : null;
    }

    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
        // Already an embed
        if (path.startsWith('/embed/')) return url.toString();

        // /watch?v=<id>
        const v = url.searchParams.get('v');
        if (v && /^[\w-]{6,}$/.test(v)) return `https://www.youtube.com/embed/${v}`;

        // /shorts/<id> and /live/<id>
        const shorts = /^\/(shorts|live)\/([\w-]{6,})$/.exec(path);
        if (shorts) return `https://www.youtube.com/embed/${shorts[2]}`;

        return null;
    }

    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
        if (path.startsWith('/video/')) return `https://player.vimeo.com${path}`;
        const id = /^\/(\d{6,})/.exec(path);
        return id ? `https://player.vimeo.com/video/${id[1]}` : null;
    }

    return null;
}

/** True when this article's category makes it a project. */
export function isProjectCategory(name: string | null | undefined): boolean {
    return (name ?? '').toLowerCase() === PROJECT_CATEGORY;
}
