/**
 * Discord OAuth2 (authorization code, confidential client).
 *
 * The redirect back from Discord is a plain browser navigation, so it carries no
 * Authorization header. The caller's identity travels inside `state`, signed with
 * HMAC and short-lived, which also serves as the CSRF defence. Nothing is read
 * from the query string without verifying that signature first.
 *
 * PKCE is not used on purpose: the code is exchanged server-side with the client
 * secret, so this is a confidential client. PKCE protects public clients (SPA,
 * mobile) and Discord does not support it for this flow.
 *
 * No Discord token is ever stored. The access token lives inside one request,
 * long enough to read the profile, and is revoked right after.
 */
import crypto from 'crypto';

const DISCORD_API = 'https://discord.com/api/v10';
const AUTHORIZE_URL = 'https://discord.com/oauth2/authorize';
const STATE_TTL_MS = 10 * 60 * 1000;
const OAUTH_SCOPES = 'identify';

export type DiscordOAuthErrorCode =
    | 'not_configured'
    | 'invalid_state'
    | 'expired_state'
    | 'exchange_failed'
    | 'profile_failed';

export class DiscordOAuthError extends Error {
    constructor(public code: DiscordOAuthErrorCode, message?: string) {
        super(message ?? code);
        this.name = 'DiscordOAuthError';
    }
}

export interface DiscordConfig {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    stateSecret: string;
}

export interface DiscordProfile {
    id: string;
    username: string;
    globalName: string | null;
    avatar: string | null;
}

/**
 * Read at call time, not at import time: the site must keep booting when the
 * Discord integration is not configured yet.
 */
export function getDiscordConfig(): DiscordConfig | null {
    const clientId = process.env.DISCORD_CLIENT_ID?.trim();
    const clientSecret = process.env.DISCORD_CLIENT_SECRET?.trim();
    const redirectUri = process.env.DISCORD_REDIRECT_URI?.trim();
    const stateSecret = process.env.DISCORD_OAUTH_STATE_SECRET?.trim();

    if (!clientId || !clientSecret || !redirectUri || !stateSecret) {
        return null;
    }
    return { clientId, clientSecret, redirectUri, stateSecret };
}

export function isDiscordConfigured(): boolean {
    return getDiscordConfig() !== null;
}

function requireConfig(): DiscordConfig {
    const config = getDiscordConfig();
    if (!config) {
        throw new DiscordOAuthError('not_configured', 'Discord integration is not configured');
    }
    return config;
}

function base64url(input: Buffer | string): string {
    return Buffer.from(input).toString('base64url');
}

function sign(payload: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

/**
 * `state` carries the user id so the callback never has to trust the query string.
 */
export function signState(userId: number, config: DiscordConfig = requireConfig(), now = Date.now()): string {
    const payload = base64url(JSON.stringify({
        u: userId,
        n: crypto.randomBytes(12).toString('base64url'),
        e: now + STATE_TTL_MS,
    }));
    return `${payload}.${sign(payload, config.stateSecret)}`;
}

export function verifyState(state: string, config: DiscordConfig = requireConfig(), now = Date.now()): number {
    const [payload, signature] = (state ?? '').split('.');
    if (!payload || !signature) {
        throw new DiscordOAuthError('invalid_state');
    }

    const expected = sign(payload, config.stateSecret);
    const given = Buffer.from(signature);
    const want = Buffer.from(expected);
    if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) {
        throw new DiscordOAuthError('invalid_state');
    }

    let decoded: { u?: unknown; e?: unknown };
    try {
        decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    } catch {
        throw new DiscordOAuthError('invalid_state');
    }

    if (typeof decoded.u !== 'number' || !Number.isInteger(decoded.u) || typeof decoded.e !== 'number') {
        throw new DiscordOAuthError('invalid_state');
    }
    if (decoded.e < now) {
        throw new DiscordOAuthError('expired_state');
    }
    return decoded.u;
}

export function buildAuthorizeUrl(state: string, config: DiscordConfig = requireConfig()): string {
    const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        response_type: 'code',
        scope: OAUTH_SCOPES,
        state,
        prompt: 'consent',
    });
    return `${AUTHORIZE_URL}?${params.toString()}`;
}

async function exchangeCode(code: string, config: DiscordConfig): Promise<string> {
    const response = await fetch(`${DISCORD_API}/oauth2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: config.clientId,
            client_secret: config.clientSecret,
            grant_type: 'authorization_code',
            code,
            redirect_uri: config.redirectUri,
        }),
    });

    if (!response.ok) {
        // the body can echo the code back, so it is not logged
        throw new DiscordOAuthError('exchange_failed', `Discord token endpoint returned ${response.status}`);
    }

    const data = await response.json() as { access_token?: string };
    if (!data.access_token) {
        throw new DiscordOAuthError('exchange_failed', 'Discord token response had no access_token');
    }
    return data.access_token;
}

async function fetchProfile(accessToken: string): Promise<DiscordProfile> {
    const response = await fetch(`${DISCORD_API}/users/@me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
        throw new DiscordOAuthError('profile_failed', `Discord user endpoint returned ${response.status}`);
    }

    const user = await response.json() as { id?: string; username?: string; global_name?: string | null; avatar?: string | null };
    if (!user.id || !user.username) {
        throw new DiscordOAuthError('profile_failed', 'Discord user response was incomplete');
    }

    return {
        id: user.id,
        username: user.username,
        globalName: user.global_name ?? null,
        avatar: user.avatar ?? null,
    };
}

async function revokeToken(accessToken: string, config: DiscordConfig): Promise<void> {
    try {
        await fetch(`${DISCORD_API}/oauth2/token/revoke`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: config.clientId,
                client_secret: config.clientSecret,
                token: accessToken,
            }),
        });
    } catch (error) {
        // best effort: the token expires on its own and is never stored
        console.warn('Discord token revoke failed');
    }
}

/**
 * Exchange the callback code for the Discord identity, then drop the token.
 */
export async function resolveProfileFromCode(code: string, config: DiscordConfig = requireConfig()): Promise<DiscordProfile> {
    const accessToken = await exchangeCode(code, config);
    try {
        return await fetchProfile(accessToken);
    } finally {
        await revokeToken(accessToken, config);
    }
}
