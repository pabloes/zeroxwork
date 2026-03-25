/**
 * Centralized environment variable validation.
 * This module loads dotenv itself so it works regardless of ESM import order.
 *
 * - Import `env` for validated secret values.
 * - Import `requireEnv` for the pure validation function (used in tests).
 */
import dotenv from 'dotenv';
dotenv.config();

export function requireEnv(name: string): string {
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
    VERIFICATION_RESEND_SECRET: requireEnv('VERIFICATION_RESEND_SECRET'),
};
