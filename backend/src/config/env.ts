/**
 * Centralized environment variable validation.
 * Import `env` from this module instead of reading process.env directly for secrets.
 * The app will fail to start if any required secret is missing.
 */

function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value || !value.trim()) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

export const env = {
    JWT_SECRET: requireEnv('JWT_SECRET'),
    SESSION_SECRET: requireEnv('SESSION_SECRET'),
    ADMIN_COOKIE_PASSWORD: requireEnv('ADMIN_COOKIE_PASSWORD'),
};
