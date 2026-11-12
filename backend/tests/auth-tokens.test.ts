/**
 * The rule these tests exist for: a token made for one job does not work for
 * another. The verification link used to pass as a session for six hours.
 */
import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import {
    AuthTokenError,
    fingerprint,
    readEmailChange,
    readEmailVerification,
    readPasswordReset,
    readSession,
    sessionStillValid,
    signEmailChange,
    signEmailVerification,
    signPasswordReset,
    signSession,
} from '../src/services/auth-tokens.js';

const SECRET = 'a-secret-for-tests';
const user = { id: 7, email: 'ana@example.com', role: 'USER', password: '$argon2id$old-hash' };

const codeOf = (run: () => unknown) => {
    try { run(); } catch (error) { return error instanceof AuthTokenError ? error.code : `other: ${error}`; }
    return 'accepted';
};

describe('sessions', () => {
    it('opens for the account it was signed for', () => {
        expect(readSession(signSession(user, SECRET), SECRET).userId).toBe(7);
    });

    it('does not carry the password hash, only a fingerprint of it', () => {
        const payload = jwt.decode(signSession(user, SECRET)) as Record<string, unknown>;
        expect(JSON.stringify(payload)).not.toContain('argon2');
        expect(payload.pv).toBe(fingerprint(SECRET, user.password));
    });

    it('dies when the password changes, and not before', () => {
        const claims = readSession(signSession(user, SECRET), SECRET);
        expect(sessionStillValid(claims, user.password, SECRET)).toBe(true);
        expect(sessionStillValid(claims, '$argon2id$new-hash', SECRET)).toBe(false);
    });

    it('is not opened by any link we mail', () => {
        const mailed = [
            signEmailVerification(7, SECRET),
            signPasswordReset(user, SECRET),
            signEmailChange(user, 'new@example.com', SECRET),
        ];
        for (const token of mailed) {
            expect(codeOf(() => readSession(token, SECRET))).toBe('TOKEN_INVALID');
        }
    });

    it('is not opened by a verification link from before this change', () => {
        // exactly what the mail used to carry: a bare userId, signed like a session
        const old = jwt.sign({ userId: 7 }, SECRET, { expiresIn: '6h' });
        expect(codeOf(() => readSession(old, SECRET))).toBe('TOKEN_INVALID');
    });

    it('still accepts a session opened before this change, until it runs out', () => {
        const old = jwt.sign({ userId: 7, email: user.email, role: 'USER' }, SECRET, { expiresIn: 10_000 });
        const claims = readSession(old, SECRET);
        expect(claims).toEqual({ userId: 7, pv: null });
        expect(sessionStillValid(claims, 'whatever the hash is now', SECRET)).toBe(true);
    });

    it('rejects another secret, a forged purpose and an expired token', () => {
        expect(codeOf(() => readSession(signSession(user, 'another-secret'), SECRET))).toBe('TOKEN_INVALID');
        const wrongPurpose = jwt.sign({ userId: 7, role: 'ADMIN', purpose: 'password_reset' }, SECRET);
        expect(codeOf(() => readSession(wrongPurpose, SECRET))).toBe('TOKEN_INVALID');
        const expired = jwt.sign({ userId: 7, purpose: 'session' }, SECRET, { expiresIn: -10 });
        expect(codeOf(() => readSession(expired, SECRET))).toBe('TOKEN_EXPIRED');
        expect(codeOf(() => readSession('not-a-token', SECRET))).toBe('TOKEN_INVALID');
    });

    it('refuses a token signed with no algorithm at all', () => {
        const unsigned = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from('{"userId":7,"purpose":"session"}').toString('base64url')}.`;
        expect(codeOf(() => readSession(unsigned, SECRET))).toBe('TOKEN_INVALID');
    });
});

describe('email verification', () => {
    it('verifies the account it was mailed for', () => {
        expect(readEmailVerification(signEmailVerification(7, SECRET), SECRET)).toEqual({ userId: 7 });
    });

    it('honours a link mailed before this change, in the shape it had', () => {
        const old = jwt.sign({ userId: 7 }, SECRET, { expiresIn: '6h' });
        expect(readEmailVerification(old, SECRET)).toEqual({ userId: 7 });
    });

    it('is not satisfied by a session, old or new, nor by a reset link', () => {
        const oldSession = jwt.sign({ userId: 7, email: user.email, role: 'USER' }, SECRET);
        for (const token of [signSession(user, SECRET), oldSession, signPasswordReset(user, SECRET)]) {
            expect(codeOf(() => readEmailVerification(token, SECRET))).toBe('TOKEN_INVALID');
        }
    });

    it('says when it is too old', () => {
        const old = jwt.sign({ userId: 7 }, SECRET, { expiresIn: -10 });
        expect(codeOf(() => readEmailVerification(old, SECRET))).toBe('TOKEN_EXPIRED');
    });
});

describe('password reset', () => {
    it('matches the password it was made to replace, and only that one', () => {
        const claims = readPasswordReset(signPasswordReset(user, SECRET), SECRET);
        expect(claims.userId).toBe(7);
        expect(claims.matches(user.password)).toBe(true);
        // what makes the link single use: the password it knew is gone
        expect(claims.matches('$argon2id$new-hash')).toBe(false);
    });

    it('is not satisfied by a session or a verification link', () => {
        for (const token of [signSession(user, SECRET), signEmailVerification(7, SECRET)]) {
            expect(codeOf(() => readPasswordReset(token, SECRET))).toBe('TOKEN_INVALID');
        }
    });

    it('cannot be minted by someone who only holds a session', () => {
        // same claims, signed the way a session is: the key is not the same
        const forged = jwt.sign({ userId: 7, purpose: 'password_reset', fp: fingerprint(SECRET, user.password) }, SECRET);
        expect(codeOf(() => readPasswordReset(forged, SECRET))).toBe('TOKEN_INVALID');
    });

    it('lasts half an hour', () => {
        const payload = jwt.decode(signPasswordReset(user, SECRET)) as { exp: number; iat: number };
        expect(payload.exp - payload.iat).toBe(30 * 60);
    });
});

describe('email change', () => {
    it('carries the new address and is tied to the old one and the password', () => {
        const claims = readEmailChange(signEmailChange(user, 'new@example.com', SECRET), SECRET);
        expect(claims.newEmail).toBe('new@example.com');
        expect(claims.matches(user)).toBe(true);
        expect(claims.matches({ ...user, email: 'new@example.com' })).toBe(false);
        expect(claims.matches({ ...user, password: '$argon2id$new-hash' })).toBe(false);
    });

    it('is not satisfied by a reset link, whose claims look alike', () => {
        expect(codeOf(() => readEmailChange(signPasswordReset(user, SECRET), SECRET))).toBe('TOKEN_INVALID');
    });
});

describe('fingerprint', () => {
    it('depends on the secret, so it gives nothing away about the hash', () => {
        expect(fingerprint(SECRET, user.password)).not.toBe(fingerprint('another-secret', user.password));
    });

    it('keeps its parts apart', () => {
        expect(fingerprint(SECRET, 'ab', 'c')).not.toBe(fingerprint(SECRET, 'a', 'bc'));
    });
});
