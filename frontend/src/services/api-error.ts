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

    if (status === 401 || status === 403) return t('article.error.unauthorized');
    if (status === 413) return t('article.error.too_large');

    // Validation problems come back as { error }, unexpected ones as { message }.
    const fromApi = typeof data === 'object' && data !== null
        ? (data as Record<string, unknown>).error ?? (data as Record<string, unknown>).message
        : undefined;

    return typeof fromApi === 'string' && fromApi.trim() !== '' ? fromApi : t(fallbackKey);
}
