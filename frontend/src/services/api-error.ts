import axios from 'axios';

/**
 * Turns a failed request into something the author can act on.
 *
 * The article forms used to show one hardcoded line ("Error creating article.")
 * for every failure, so a rejected save looked exactly like a broken page: a 400
 * saying the body was empty, an expired session and a backend that is not
 * running were all reported with the same sentence.
 *
 * Statuses we can name get a translated line; anything else falls back to what
 * the API itself said, which is at least specific.
 */
export function apiErrorMessage(
    error: unknown,
    t: (key: string) => string,
    fallbackKey: string,
): string {
    if (!axios.isAxiosError(error)) return t(fallbackKey);

    // No response at all: backend down, or the dev proxy points nowhere.
    if (!error.response) return t('article.error.network');

    const { status, data } = error.response;

    // 401 and 403 are opposite problems and sharing a line costs real time: one
    // is fixed by signing in again, the other never is. Telling someone their
    // session expired when the server said "not yours to edit" sends them off
    // re-authenticating, reinstalling things, doubting their password -- and the
    // actual answer, that they are the wrong person for this, is never shown.
    if (status === 401) return t('article.error.unauthorized');
    if (status === 403) return t('article.error.forbidden');
    if (status === 413) return t('article.error.too_large');

    const body = typeof data === 'object' && data !== null ? data as Record<string, unknown> : {};

    // A refusal we have words of our own for. The API answers in English, which
    // is fine for a developer reading a log and wrong for a member who picked
    // Spanish: when it names a code we know, our own line wins.
    const code = typeof body.code === 'string' ? body.code : null;
    const key = code ? REFUSAL_KEYS[code] : undefined;
    if (key) return t(key);

    // Validation problems come back as { error }, unexpected ones as { message }.
    const fromApi = body.error ?? body.message;

    return typeof fromApi === 'string' && fromApi.trim() !== '' ? fromApi : t(fallbackKey);
}

/**
 * The refusals the API gives a code for, and what we say instead. Anything not
 * listed keeps the server's own English sentence, which is better than a vague
 * translated one: it at least says what went wrong.
 */
const REFUSAL_KEYS: Record<string, string> = {
    MEMBERS_REQUIRED: 'project.error.members_required',
    COVER_REQUIRED: 'project.error.cover_required',
    SCREENSHOTS_FEW: 'project.error.screenshots_few',
    VIDEO_HOST_NOT_ALLOWED: 'project.error.video_host',
    SITE_URL_INVALID: 'project.error.site_url',
    REPO_URL_INVALID: 'project.error.repo_url',
    REPO_HOST_NOT_ALLOWED: 'project.error.repo_url',
    DATES_BACKWARDS: 'project.error.dates_backwards',
    TITLE_REQUIRED: 'project.error.title_required',
    CONTENT_REQUIRED: 'project.error.content_required',
    SUMMARY_LONG: 'project.error.summary_long',
};
