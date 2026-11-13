import axios from 'axios';

/**
 * The refusals the auth endpoints give a `code` for, and the line we say
 * instead. The API answers in English; a code we know gets our own words, in
 * the reader's language.
 */
const CODE_KEYS: Record<string, string> = {
    INVALID_CREDENTIALS: 'auth.error.invalid_credentials',
    EMAIL_NOT_VERIFIED: 'auth.error.email_not_verified',
    EMAIL_INVALID: 'auth.error.email_invalid',
    EMAIL_SAME: 'auth.error.email_same',
    EMAIL_TAKEN: 'auth.error.email_taken',
    WRONG_PASSWORD: 'auth.error.wrong_password',
    PASSWORD_SAME: 'auth.error.password_same',
    // Carries {min}: render it through withPasswordMin().
    PASSWORD_SHORT: 'register.password_short',
    TOKEN_INVALID: 'auth.error.token_invalid',
    TOKEN_EXPIRED: 'auth.error.token_expired',
    MAIL_FAILED: 'auth.error.mail_failed',
    HUMAN_CHECK_FAILED: 'auth.error.human_check_failed',
    TOO_MANY_ACCOUNTS: 'auth.error.too_many_accounts',
};

/** What to say when the failure is not one we have a line for. */
export const AUTH_ERROR_GENERIC = 'auth.error.generic';

/** The `code` of a refused request, when the body carries one. */
export function authErrorCode(error: unknown): string | null {
    if (!axios.isAxiosError(error)) return null;
    const code = (error.response?.data as { code?: unknown } | undefined)?.code;
    return typeof code === 'string' ? code : null;
}

/**
 * The i18n key for a failed auth request, or null when we have no words of
 * our own for it. A key and not a translated string, so it can be kept in
 * state and still follow a change of language.
 */
export function authErrorKey(error: unknown): string | null {
    const code = authErrorCode(error);
    if (code && CODE_KEYS[code]) return CODE_KEYS[code];

    // The rate limiter answers { message }, without a code.
    if (axios.isAxiosError(error) && error.response?.status === 429) return 'auth.error.too_many_attempts';

    return null;
}
