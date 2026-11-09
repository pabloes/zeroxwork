/**
 * The fields a project carries that an article never had: a summary, the dates
 * it ran for, what state it is in, where to see it and where its code lives.
 *
 * Kept next to project-media.ts, which owns the cover, the gallery and the
 * video. Everything here is validated in code rather than in the schema so the
 * allowed hosts and states can change without a migration.
 */

/** A summary is a line on a card, not a second body. */
export const SUMMARY_MAX = 300;
export const TITLE_MAX = 200;

/** A URL longer than this is a mistake, not a link. */
const URL_MAX = 500;

/**
 * What a project can say about itself. A closed list rather than free text: it
 * is shown as a chip next to the dates and translated on the frontend, which
 * only works for values we know.
 */
export const PROJECT_STATUSES = ['live', 'wip', 'archived'] as const;
export type ProjectStatus = typeof PROJECT_STATUSES[number];

/**
 * Where a repository may live. GitHub and GitLab, as asked: the field exists to
 * point at the code, and an arbitrary host behind a "repository" button is a
 * link we would be vouching for.
 */
export const REPO_HOSTS = ['github.com', 'gitlab.com'] as const;

/** Nothing older than this is a project of ours; nothing later is a date typo. */
const YEAR_MIN = 1990;

export type FieldErrorCode =
    | 'TITLE_REQUIRED'
    | 'TITLE_LONG'
    | 'CONTENT_REQUIRED'
    | 'SUMMARY_LONG'
    | 'STATUS_INVALID'
    | 'SITE_URL_INVALID'
    | 'REPO_URL_INVALID'
    | 'REPO_HOST_NOT_ALLOWED'
    | 'DATE_INVALID'
    | 'DATES_BACKWARDS'
    | 'MEMBERS_REQUIRED';

export type FieldResult<T> =
    | { ok: true; value: T }
    | { ok: false; code: FieldErrorCode };

const asText = (input: unknown): string =>
    input === undefined || input === null ? '' : String(input).trim();

/** The title, which is also what the slug comes from. */
export function validateTitle(input: unknown): FieldResult<string> {
    const value = asText(input);
    if (value === '') return { ok: false, code: 'TITLE_REQUIRED' };
    if (value.length > TITLE_MAX) return { ok: false, code: 'TITLE_LONG' };
    return { ok: true, value };
}

/** The write-up. A project without one is an empty page with a gallery on it. */
export function validateContent(input: unknown): FieldResult<string> {
    const value = asText(input);
    if (value === '') return { ok: false, code: 'CONTENT_REQUIRED' };
    return { ok: true, value };
}

/** The one-liner for the card, or null. Empty clears it. */
export function validateSummary(input: unknown): FieldResult<string | null> {
    const value = asText(input);
    if (value === '') return { ok: true, value: null };
    if (value.length > SUMMARY_MAX) return { ok: false, code: 'SUMMARY_LONG' };
    return { ok: true, value };
}

/** One of the known states, or null. */
export function validateStatus(input: unknown): FieldResult<ProjectStatus | null> {
    const value = asText(input).toLowerCase();
    if (value === '') return { ok: true, value: null };
    if (!(PROJECT_STATUSES as readonly string[]).includes(value)) {
        return { ok: false, code: 'STATUS_INVALID' };
    }
    return { ok: true, value: value as ProjectStatus };
}

/** Where to go see or play the thing itself. Any https host. */
export function validateSiteUrl(input: unknown): FieldResult<string | null> {
    const raw = asText(input);
    if (raw === '') return { ok: true, value: null };
    if (raw.length > URL_MAX) return { ok: false, code: 'SITE_URL_INVALID' };

    let url: URL;
    try {
        url = new URL(raw);
    } catch {
        return { ok: false, code: 'SITE_URL_INVALID' };
    }
    if (url.protocol !== 'https:') return { ok: false, code: 'SITE_URL_INVALID' };

    return { ok: true, value: url.toString() };
}

/** The repository. Same shape as the site link, but only on a host we allow. */
export function validateRepoUrl(input: unknown): FieldResult<string | null> {
    const raw = asText(input);
    if (raw === '') return { ok: true, value: null };
    if (raw.length > URL_MAX) return { ok: false, code: 'REPO_URL_INVALID' };

    let url: URL;
    try {
        url = new URL(raw);
    } catch {
        return { ok: false, code: 'REPO_URL_INVALID' };
    }
    if (url.protocol !== 'https:') return { ok: false, code: 'REPO_URL_INVALID' };

    // Exact host or a subdomain of it, so gitlab.example.com is refused while
    // www.github.com passes -- the same rule the video hosts go by.
    const host = url.hostname.toLowerCase();
    const allowed = REPO_HOSTS.some((base) => host === base || host.endsWith(`.${base}`));
    if (!allowed) return { ok: false, code: 'REPO_HOST_NOT_ALLOWED' };

    // A bare host is not a repository, and a "repository" button that opens
    // github.com helps nobody.
    if (url.pathname.replace(/\/+$/, '') === '') return { ok: false, code: 'REPO_URL_INVALID' };

    return { ok: true, value: url.toString() };
}

/** One date, or null. Accepts what a date input sends: YYYY-MM-DD. */
export function validateDate(input: unknown): FieldResult<Date | null> {
    const raw = asText(input);
    if (raw === '') return { ok: true, value: null };

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return { ok: false, code: 'DATE_INVALID' };

    const year = parsed.getUTCFullYear();
    if (year < YEAR_MIN || year > new Date().getUTCFullYear() + 1) {
        return { ok: false, code: 'DATE_INVALID' };
    }

    return { ok: true, value: parsed };
}

/** The two dates together: either may be missing, but they cannot be inverted. */
export function validateDates(startedAt: unknown, endedAt: unknown): FieldResult<{ startedAt: Date | null; endedAt: Date | null }> {
    const started = validateDate(startedAt);
    if (!started.ok) return started;

    const ended = validateDate(endedAt);
    if (!ended.ok) return ended;

    if (started.value && ended.value && ended.value.getTime() < started.value.getTime()) {
        return { ok: false, code: 'DATES_BACKWARDS' };
    }

    return { ok: true, value: { startedAt: started.value, endedAt: ended.value } };
}

/**
 * The slug a project answers to. A project is reachable at /portfolio/<id> as
 * well, so a slug made only of digits would be ambiguous: it is given a word in
 * front rather than refused, because the author did nothing wrong by calling
 * their project "2048".
 */
export function slugWithLetter(slug: string): string {
    return /[a-z]/.test(slug) ? slug : `project-${slug}`;
}

/** Human wording for each code, in English; the frontend has its own per language. */
export const FIELD_ERRORS: Record<FieldErrorCode, string> = {
    TITLE_REQUIRED: 'A project needs a title.',
    TITLE_LONG: `A project title is at most ${TITLE_MAX} characters.`,
    CONTENT_REQUIRED: 'A project needs a write-up.',
    SUMMARY_LONG: `A project summary is at most ${SUMMARY_MAX} characters.`,
    STATUS_INVALID: `A project status is one of ${PROJECT_STATUSES.join(', ')}.`,
    SITE_URL_INVALID: 'The project link is not a valid https URL.',
    REPO_URL_INVALID: 'The repository link is not a valid https URL.',
    REPO_HOST_NOT_ALLOWED: `A repository must be on ${REPO_HOSTS.join(' or ')}.`,
    DATE_INVALID: 'That is not a date we can read.',
    DATES_BACKWARDS: 'The end date is before the start date.',
    MEMBERS_REQUIRED: 'A project needs at least one member.',
};
