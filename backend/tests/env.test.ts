import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Tests for requireEnv from src/config/env.ts.
 * Uses vi.resetModules() + dynamic imports to re-evaluate the module per test.
 * Mocks dotenv so .env file doesn't interfere with controlled test scenarios.
 */

vi.mock('dotenv', () => ({ default: { config: () => {} }, config: () => {} }));

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
        process.env.JWT_SECRET = 'test-jwt';
        process.env.SESSION_SECRET = 'test-session';
        process.env.ADMIN_COOKIE_PASSWORD = 'test-cookie';

        const { requireEnv } = await loadModule();
        expect(requireEnv('JWT_SECRET')).toBe('test-jwt');
    });

    it('throws when env var is undefined', async () => {
        process.env.JWT_SECRET = 'x';
        process.env.SESSION_SECRET = 'x';
        process.env.ADMIN_COOKIE_PASSWORD = 'x';

        const { requireEnv } = await loadModule();
        delete process.env.MISSING_VAR;
        expect(() => requireEnv('MISSING_VAR'))
            .toThrow('Missing required environment variable: MISSING_VAR');
    });

    it('throws on empty string', async () => {
        process.env.JWT_SECRET = 'x';
        process.env.SESSION_SECRET = 'x';
        process.env.ADMIN_COOKIE_PASSWORD = 'x';

        const { requireEnv } = await loadModule();
        process.env.EMPTY = '';
        expect(() => requireEnv('EMPTY'))
            .toThrow('Missing required environment variable: EMPTY');
    });

    it('throws on whitespace-only value', async () => {
        process.env.JWT_SECRET = 'x';
        process.env.SESSION_SECRET = 'x';
        process.env.ADMIN_COOKIE_PASSWORD = 'x';

        const { requireEnv } = await loadModule();
        process.env.WS = '   ';
        expect(() => requireEnv('WS'))
            .toThrow('Missing required environment variable: WS');
    });

    it('env object fails when JWT_SECRET is missing', async () => {
        delete process.env.JWT_SECRET;
        process.env.SESSION_SECRET = 'x';
        process.env.ADMIN_COOKIE_PASSWORD = 'x';

        await expect(loadModule())
            .rejects.toThrow('Missing required environment variable: JWT_SECRET');
    });

    it('env object fails when SESSION_SECRET is missing', async () => {
        process.env.JWT_SECRET = 'x';
        delete process.env.SESSION_SECRET;
        process.env.ADMIN_COOKIE_PASSWORD = 'x';

        await expect(loadModule())
            .rejects.toThrow('Missing required environment variable: SESSION_SECRET');
    });
});
