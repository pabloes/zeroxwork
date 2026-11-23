/**
 * The fields a project carries beyond its media, with the same limits as
 * backend/src/config/project-fields.ts, which has the last word. These are here
 * so the form can say what is wrong before anyone presses save.
 */

export const SUMMARY_MAX = 300;
export const TITLE_MAX = 200;

/** Mirrors PROJECT_STATUSES in the backend. The label is translated per state. */
export const PROJECT_STATUSES = ['live', 'wip', 'archived'] as const;
export type ProjectStatus = typeof PROJECT_STATUSES[number];

/** Mirrors REPO_HOSTS: where a repository may live. */
export const REPO_HOSTS = ['github.com', 'gitlab.com'];

function parsedHttps(input: string): URL | null {
    const raw = input.trim();
    if (raw === '') return null;
    try {
        const url = new URL(raw);
        return url.protocol === 'https:' ? url : null;
    } catch {
        return null;
    }
}

/** Whether the site link will be accepted. Empty counts as fine: it is optional. */
export function isAllowedSiteUrl(input: string): boolean {
    if (input.trim() === '') return true;
    return parsedHttps(input) !== null;
}

/** Whether the repository link will be accepted. Empty counts as fine. */
export function isAllowedRepoUrl(input: string): boolean {
    if (input.trim() === '') return true;

    const url = parsedHttps(input);
    if (!url) return false;

    const host = url.hostname.toLowerCase();
    const onKnownHost = REPO_HOSTS.some((base) => host === base || host.endsWith(`.${base}`));

    // A bare host is not a repository: the backend refuses it too.
    return onKnownHost && url.pathname.replace(/\/+$/, '') !== '';
}

/** The translation key for a status chip, so the chip is not English-only. */
export function statusKey(status: string | null | undefined): string | null {
    const value = (status ?? '').toLowerCase();
    return (PROJECT_STATUSES as readonly string[]).includes(value) ? `project.status_${value}` : null;
}


/**
 * A Discord channel id as the form checks it: digits only, 17 to 20 of them.
 * The same rule the server applies, so the field goes red before a save that
 * would be refused anyway.
 */
export function isValidChannelId(value: string): boolean {
    const raw = value.trim();
    return raw === '' || /^[0-9]{17,20}$/.test(raw);
}
