/**
 * Every signed token the account system hands out, and the rule that keeps
 * them apart: a token made for one job must not work for another.
 *
 * It used to be one secret and one shape. The link in the verification email
 * was a JWT with a `userId`, signed like a session, and the session check
 * accepted it: for six hours that link was a login.
 *
 * Now a session says it is one, and everything that travels by email is signed
 * with a key of its own, derived from the same secret. Those cannot pass the
 * session check even by mistake, because the signature does not verify.
 *
 * Pure functions on purpose: the secret comes in as an argument, so this file
 * has no environment and no database to stand in for in a test.
 */
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

export type MailedPurpose = 'email_verification' | 'password_reset' | 'email_change';

/** What the caller can tell the person: the link is wrong, or it is too old. */
export class AuthTokenError extends Error {
    readonly code: 'TOKEN_INVALID' | 'TOKEN_EXPIRED';

    constructor(code: 'TOKEN_INVALID' | 'TOKEN_EXPIRED') {
        super(code);
        this.name = 'AuthTokenError';
        this.code = code;
    }
}

export const SESSION_TTL_SECONDS = 10_000;
export const VERIFICATION_TTL = '6h';
export const PASSWORD_RESET_TTL = '30m';
export const EMAIL_CHANGE_TTL = '1h';

const ALGORITHMS: jwt.Algorithm[] = ['HS256'];

/** One key per job, so a signature made for one never verifies for another. */
function keyFor(secret: string, label: string): Buffer {
    return crypto.createHmac('sha256', secret).update(`zeroxwork:${label}:v1`).digest();
}

function verify(token: string, key: string | Buffer): Record<string, unknown> {
    try {
        const payload = jwt.verify(token, key, { algorithms: ALGORITHMS });
        if (typeof payload !== 'object' || payload === null) throw new AuthTokenError('TOKEN_INVALID');
        return payload as Record<string, unknown>;
    } catch (error) {
        if (error instanceof AuthTokenError) throw error;
        if (error instanceof jwt.TokenExpiredError) throw new AuthTokenError('TOKEN_EXPIRED');
        throw new AuthTokenError('TOKEN_INVALID');
    }
}

function userIdOf(payload: Record<string, unknown>): number {
    if (typeof payload.userId !== 'number' || !Number.isInteger(payload.userId)) {
        throw new AuthTokenError('TOKEN_INVALID');
    }
    return payload.userId;
}

/**
 * A short, keyed digest of something that must not have changed since a token
 * was made. Keyed, so the token gives away nothing about the password hash.
 */
export function fingerprint(secret: string, ...parts: string[]): string {
    return crypto.createHmac('sha256', keyFor(secret, 'fingerprint'))
        .update(parts.join('\n'))
        .digest('base64url')
        .slice(0, 22);
}

function sameFingerprint(a: unknown, b: string): boolean {
    if (typeof a !== 'string' || a.length !== b.length) return false;
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// ---------------------------------------------------------------- sessions

export interface SessionSubject {
    id: number;
    email: string;
    role: string;
    /** The stored password hash. Only its fingerprint goes into the token. */
    password: string;
}

/**
 * `pv` ties the session to the password it was opened with: change or reset the
 * password and every session opened before stops working, which is the whole
 * point of resetting it after a scare.
 */
export function signSession(user: SessionSubject, secret: string): string {
    return jwt.sign(
        { userId: user.id, email: user.email, role: user.role, purpose: 'session', pv: fingerprint(secret, user.password) },
        secret,
        { expiresIn: SESSION_TTL_SECONDS },
    );
}

export interface SessionClaims {
    userId: number;
    /** Absent on sessions opened before password versions existed. */
    pv: string | null;
}

export function readSession(token: string, secret: string): SessionClaims {
    const payload = verify(token, secret);
    // Sessions opened before tokens named their purpose carry a role and no
    // purpose. They live under three hours, so this allowance has nothing left
    // to let through a day after the deploy of 2026-11-12 and can be deleted.
    const legacySession = payload.purpose === undefined && typeof payload.role === 'string';
    if (payload.purpose !== 'session' && !legacySession) throw new AuthTokenError('TOKEN_INVALID');
    return { userId: userIdOf(payload), pv: typeof payload.pv === 'string' ? payload.pv : null };
}

/** False when the password changed after this session was opened. */
export function sessionStillValid(claims: SessionClaims, passwordHash: string, secret: string): boolean {
    if (claims.pv === null) return true;
    return sameFingerprint(claims.pv, fingerprint(secret, passwordHash));
}

// ------------------------------------------------------ email verification

export function signEmailVerification(userId: number, secret: string): string {
    return jwt.sign({ userId, purpose: 'email_verification' }, keyFor(secret, 'email_verification'), { expiresIn: VERIFICATION_TTL });
}

export function readEmailVerification(token: string, secret: string): { userId: number } {
    try {
        const payload = verify(token, keyFor(secret, 'email_verification'));
        if (payload.purpose !== 'email_verification') throw new AuthTokenError('TOKEN_INVALID');
        return { userId: userIdOf(payload) };
    } catch (error) {
        // Mails sent before this change were signed like a session and are
        // good for six hours. Honour them, but only in the shape they had: a
        // bare `userId`. Anything carrying a role or a purpose is a session or
        // some other token, and must not verify an address. Deletable a day
        // after the deploy of 2026-11-12.
        if (error instanceof AuthTokenError && error.code === 'TOKEN_INVALID') {
            const legacy = verify(token, secret);
            if (legacy.purpose === undefined && legacy.role === undefined && legacy.email === undefined) {
                return { userId: userIdOf(legacy) };
            }
        }
        throw error;
    }
}

// ----------------------------------------------------------- password reset

/**
 * Good for one use without a table to remember it in: the token carries a
 * fingerprint of the password it is meant to replace, and stops matching the
 * moment that password is replaced, by this link or any other way.
 */
export function signPasswordReset(user: { id: number; password: string }, secret: string): string {
    return jwt.sign(
        { userId: user.id, purpose: 'password_reset', fp: fingerprint(secret, user.password) },
        keyFor(secret, 'password_reset'),
        { expiresIn: PASSWORD_RESET_TTL },
    );
}

export function readPasswordReset(token: string, secret: string): { userId: number; matches: (passwordHash: string) => boolean } {
    const payload = verify(token, keyFor(secret, 'password_reset'));
    if (payload.purpose !== 'password_reset') throw new AuthTokenError('TOKEN_INVALID');
    return {
        userId: userIdOf(payload),
        matches: (passwordHash) => sameFingerprint(payload.fp, fingerprint(secret, passwordHash)),
    };
}

// ------------------------------------------------------------- email change

/**
 * Sent to the new address, and only that proves the person owns it. Bound to
 * the address and the password the account had when it was asked for: once
 * either changes, the link is dead.
 */
export function signEmailChange(user: { id: number; email: string; password: string }, newEmail: string, secret: string): string {
    return jwt.sign(
        { userId: user.id, purpose: 'email_change', newEmail, fp: fingerprint(secret, user.email, user.password) },
        keyFor(secret, 'email_change'),
        { expiresIn: EMAIL_CHANGE_TTL },
    );
}

export function readEmailChange(token: string, secret: string): {
    userId: number;
    newEmail: string;
    matches: (current: { email: string; password: string }) => boolean;
} {
    const payload = verify(token, keyFor(secret, 'email_change'));
    if (payload.purpose !== 'email_change' || typeof payload.newEmail !== 'string') {
        throw new AuthTokenError('TOKEN_INVALID');
    }
    return {
        userId: userIdOf(payload),
        newEmail: payload.newEmail,
        matches: (current) => sameFingerprint(payload.fp, fingerprint(secret, current.email, current.password)),
    };
}
