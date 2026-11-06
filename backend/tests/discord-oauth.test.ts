import { describe, it, expect, vi, afterEach } from 'vitest';
import {
    DiscordOAuthError,
    buildAuthorizeUrl,
    getDiscordConfig,
    isDiscordConfigured,
    resolveProfileFromCode,
    signState,
    verifyState,
    type DiscordConfig,
} from '../src/services/discord-oauth.js';

const config: DiscordConfig = {
    clientId: '123456789012345678',
    clientSecret: 'secret-value',
    redirectUri: 'https://zeroxwork.com/api/discord/oauth/callback',
    stateSecret: 'state-signing-secret',
};

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
});

describe('configuration', () => {
    it('reports not configured when any variable is missing, so the site still boots', () => {
        vi.stubEnv('DISCORD_CLIENT_ID', config.clientId);
        vi.stubEnv('DISCORD_CLIENT_SECRET', config.clientSecret);
        vi.stubEnv('DISCORD_REDIRECT_URI', config.redirectUri);
        vi.stubEnv('DISCORD_OAUTH_STATE_SECRET', '');

        expect(getDiscordConfig()).toBeNull();
        expect(isDiscordConfigured()).toBe(false);
    });

    it('reads the config when every variable is present', () => {
        vi.stubEnv('DISCORD_CLIENT_ID', config.clientId);
        vi.stubEnv('DISCORD_CLIENT_SECRET', config.clientSecret);
        vi.stubEnv('DISCORD_REDIRECT_URI', config.redirectUri);
        vi.stubEnv('DISCORD_OAUTH_STATE_SECRET', config.stateSecret);

        expect(getDiscordConfig()).toEqual(config);
    });
});

describe('state', () => {
    it('round-trips the user id', () => {
        const state = signState(42, config);
        expect(verifyState(state, config)).toBe(42);
    });

    it('gives a different state every time, so one cannot be replayed by guessing', () => {
        expect(signState(42, config)).not.toBe(signState(42, config));
    });

    it('rejects a tampered user id', () => {
        const state = signState(42, config);
        const [, signature] = state.split('.');
        const forged = Buffer.from(JSON.stringify({ u: 1, n: 'x', e: Date.now() + 1000 })).toString('base64url');

        expect(() => verifyState(`${forged}.${signature}`, config)).toThrowError(
            expect.objectContaining({ code: 'invalid_state' }),
        );
    });

    it('rejects a state signed with another secret', () => {
        const state = signState(42, { ...config, stateSecret: 'other-secret' });
        expect(() => verifyState(state, config)).toThrowError(
            expect.objectContaining({ code: 'invalid_state' }),
        );
    });

    it('rejects malformed input instead of throwing something unexpected', () => {
        for (const bad of ['', 'nodot', 'a.b.c', '....']) {
            expect(() => verifyState(bad, config)).toThrowError(DiscordOAuthError);
        }
    });

    it('expires after ten minutes', () => {
        const issuedAt = Date.now();
        const state = signState(42, config, issuedAt);

        expect(verifyState(state, config, issuedAt + 9 * 60 * 1000)).toBe(42);
        expect(() => verifyState(state, config, issuedAt + 11 * 60 * 1000)).toThrowError(
            expect.objectContaining({ code: 'expired_state' }),
        );
    });
});

describe('buildAuthorizeUrl', () => {
    it('asks only for identify and carries the signed state', () => {
        const state = signState(7, config);
        const url = new URL(buildAuthorizeUrl(state, config));

        expect(url.origin + url.pathname).toBe('https://discord.com/oauth2/authorize');
        expect(url.searchParams.get('client_id')).toBe(config.clientId);
        expect(url.searchParams.get('redirect_uri')).toBe(config.redirectUri);
        expect(url.searchParams.get('response_type')).toBe('code');
        expect(url.searchParams.get('scope')).toBe('identify');
        expect(url.searchParams.get('state')).toBe(state);
    });

    it('never leaks the client secret into the browser-visible url', () => {
        expect(buildAuthorizeUrl(signState(7, config), config)).not.toContain(config.clientSecret);
    });
});

describe('resolveProfileFromCode', () => {
    function mockFetch(handlers: Record<string, () => Response>) {
        return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
            const url = String(input);
            const handler = Object.entries(handlers).find(([key]) => url.includes(key));
            if (!handler) throw new Error(`unexpected fetch to ${url}`);
            return handler[1]();
        });
    }

    const okJson = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

    it('returns the profile and revokes the token afterwards', async () => {
        const fetchSpy = mockFetch({
            'oauth2/token/revoke': () => new Response('', { status: 200 }),
            'oauth2/token': () => okJson({ access_token: 'at' }),
            'users/@me': () => okJson({ id: '99', username: 'pablo', global_name: 'Pablo', avatar: 'abc' }),
        });

        await expect(resolveProfileFromCode('the-code', config)).resolves.toEqual({
            id: '99',
            username: 'pablo',
            globalName: 'Pablo',
            avatar: 'abc',
        });

        expect(fetchSpy.mock.calls.some(([url]) => String(url).includes('token/revoke'))).toBe(true);
    });

    it('fails with exchange_failed when Discord rejects the code', async () => {
        mockFetch({ 'oauth2/token': () => new Response('{"error":"invalid_grant"}', { status: 400 }) });

        await expect(resolveProfileFromCode('bad-code', config)).rejects.toThrowError(
            expect.objectContaining({ code: 'exchange_failed' }),
        );
    });

    it('fails with profile_failed when the identity cannot be read', async () => {
        mockFetch({
            'oauth2/token/revoke': () => new Response('', { status: 200 }),
            'oauth2/token': () => okJson({ access_token: 'at' }),
            'users/@me': () => new Response('', { status: 401 }),
        });

        await expect(resolveProfileFromCode('the-code', config)).rejects.toThrowError(
            expect.objectContaining({ code: 'profile_failed' }),
        );
    });

    it('does not put the authorization code in the error message', async () => {
        mockFetch({ 'oauth2/token': () => new Response('', { status: 400 }) });

        await expect(resolveProfileFromCode('super-secret-code', config))
            .rejects.toThrowError(/^(?!.*super-secret-code).*$/);
    });
});
