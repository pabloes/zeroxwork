import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('dotenv', () => ({ default: { config: () => {} }, config: () => {} }));

// All secrets that env.ts validates at module level
const ALL_SECRETS = {
    JWT_SECRET: 'x',
    SESSION_SECRET: 'x',
    ADMIN_COOKIE_PASSWORD: 'x',
    VERIFICATION_RESEND_SECRET: 'x',
};

function setAllSecrets(overrides: Record<string, string | undefined> = {}) {
    Object.entries({ ...ALL_SECRETS, ...overrides }).forEach(([k, v]) => {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
    });
}

describe('requireEnv', () => {
    const ORIGINAL_ENV = { ...process.env };

    beforeEach(() => {
        vi.resetModules();
        process.env = { ...ORIGINAL_ENV };
    });

    async function loadModule() {
        return await import('../src/config/env.js');
    }

    it('returns the value when env var is set', async () => {
        setAllSecrets({ JWT_SECRET: 'test-jwt' });
        const { requireEnv } = await loadModule();
        expect(requireEnv('JWT_SECRET')).toBe('test-jwt');
    });

    it('throws when env var is undefined', async () => {
        setAllSecrets();
        const { requireEnv } = await loadModule();
        delete process.env.MISSING_VAR;
        expect(() => requireEnv('MISSING_VAR'))
            .toThrow('Missing required environment variable: MISSING_VAR');
    });

    it('throws on empty string', async () => {
        setAllSecrets();
        const { requireEnv } = await loadModule();
        process.env.EMPTY = '';
        expect(() => requireEnv('EMPTY'))
            .toThrow('Missing required environment variable: EMPTY');
    });

    it('throws on whitespace-only value', async () => {
        setAllSecrets();
        const { requireEnv } = await loadModule();
        process.env.WS = '   ';
        expect(() => requireEnv('WS'))
            .toThrow('Missing required environment variable: WS');
    });

    it('env object fails when JWT_SECRET is missing', async () => {
        setAllSecrets({ JWT_SECRET: undefined });
        await expect(loadModule())
            .rejects.toThrow('Missing required environment variable: JWT_SECRET');
    });

    it('env object fails when SESSION_SECRET is missing', async () => {
        setAllSecrets({ SESSION_SECRET: undefined });
        await expect(loadModule())
            .rejects.toThrow('Missing required environment variable: SESSION_SECRET');
    });

    it('env object fails when VERIFICATION_RESEND_SECRET is missing', async () => {
        setAllSecrets({ VERIFICATION_RESEND_SECRET: undefined });
        await expect(loadModule())
            .rejects.toThrow('Missing required environment variable: VERIFICATION_RESEND_SECRET');
    });
});
