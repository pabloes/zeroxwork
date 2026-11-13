import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import {
    HUMAN_CHECK_MAX_NUMBER,
    HUMAN_CHECK_TTL_MS,
    SpentChallenges,
    createChallenge,
    verifySolution,
} from '../src/services/human-check.js';

const SECRET = 'a-secret-for-tests';
const NOW = 1_800_000_000_000;

const sha256 = (text: string) => crypto.createHash('sha256').update(text).digest('hex');

/** What the browser does: try numbers until the hash matches. */
function solve(challenge: { challenge: string; salt: string; maxNumber: number; signature: string }) {
    for (let number = 0; number <= challenge.maxNumber; number++) {
        if (sha256(challenge.salt + number) === challenge.challenge) {
            return { challenge: challenge.challenge, salt: challenge.salt, number, signature: challenge.signature };
        }
    }
    throw new Error('no number matches');
}

describe('the work a sign-up has to do', () => {
    it('is accepted when the number behind the hash is found', () => {
        const challenge = createChallenge(SECRET, { now: NOW, maxNumber: 2000 });
        const result = verifySolution(SECRET, solve(challenge), NOW + 1000);
        expect(result).toEqual({ ok: true, id: challenge.signature, expiresAt: NOW + HUMAN_CHECK_TTL_MS });
    });

    it('hides the answer anywhere in the range, the ends included', () => {
        for (const number of [0, 1, 1999, 2000]) {
            const challenge = createChallenge(SECRET, { now: NOW, maxNumber: 2000, number });
            expect(solve(challenge).number).toBe(number);
        }
    });

    it('asks for real work by default, and never the same twice', () => {
        const one = createChallenge(SECRET);
        const two = createChallenge(SECRET);
        expect(one.maxNumber).toBe(HUMAN_CHECK_MAX_NUMBER);
        expect(one.maxNumber).toBeGreaterThanOrEqual(50_000);
        expect(one.salt).not.toBe(two.salt);
        expect(one.challenge).not.toBe(two.challenge);
    });

    it('refuses a wrong number and one outside the range', () => {
        const challenge = createChallenge(SECRET, { now: NOW, maxNumber: 2000, number: 77 });
        const good = solve(challenge);
        expect(verifySolution(SECRET, { ...good, number: 78 }, NOW)).toEqual({ ok: false, reason: 'wrong' });
        expect(verifySolution(SECRET, { ...good, number: -1 }, NOW)).toEqual({ ok: false, reason: 'wrong' });
        expect(verifySolution(SECRET, { ...good, number: 2001 }, NOW)).toEqual({ ok: false, reason: 'wrong' });
    });

    it('expires', () => {
        const challenge = createChallenge(SECRET, { now: NOW, maxNumber: 2000 });
        const good = solve(challenge);
        expect(verifySolution(SECRET, good, NOW + HUMAN_CHECK_TTL_MS)).toMatchObject({ ok: true });
        expect(verifySolution(SECRET, good, NOW + HUMAN_CHECK_TTL_MS + 1)).toEqual({ ok: false, reason: 'expired' });
    });

    it('cannot be made easier or longer-lived by editing what came back', () => {
        const challenge = createChallenge(SECRET, { now: NOW, maxNumber: 2000, number: 500 });
        const good = solve(challenge);
        const [random, expires] = good.salt.split('.');

        // a later expiry, or a smaller range to search: the signature no longer holds
        const later = `${random}.${Number(expires) + 3_600_000}.2000`;
        expect(verifySolution(SECRET, { ...good, salt: later }, NOW)).toEqual({ ok: false, reason: 'forged' });

        // a challenge of their own making, with an answer they already know,
        // carrying the signature of a real one
        const ownSalt = `${random}.${expires}.2000`;
        const own = { challenge: sha256(`${ownSalt}0`), salt: ownSalt, number: 0, signature: good.signature };
        expect(sha256(own.salt + own.number)).toBe(own.challenge);
        expect(verifySolution(SECRET, own, NOW)).toEqual({ ok: false, reason: 'forged' });
    });

    it('is not accepted by a server with another secret', () => {
        const good = solve(createChallenge('another-secret', { now: NOW, maxNumber: 2000 }));
        expect(verifySolution(SECRET, good, NOW)).toEqual({ ok: false, reason: 'forged' });
    });

    it('answers "malformed", not a crash, to anything that is not a solution', () => {
        const good = solve(createChallenge(SECRET, { now: NOW, maxNumber: 2000 }));
        const junk: unknown[] = [
            undefined, null, 'yes', 42, [], {},
            { ...good, number: '12' }, { ...good, number: 1.5 }, { ...good, number: NaN },
            { ...good, signature: 'short' }, { ...good, signature: 42 }, { ...good, challenge: 'zz'.repeat(32) },
            { ...good, salt: 'x'.repeat(500) }, { ...good, salt: undefined },
        ];
        for (const input of junk) {
            expect(verifySolution(SECRET, input, NOW)).toEqual({ ok: false, reason: 'malformed' });
        }
    });
});

describe('one solved challenge, one sign-up', () => {
    it('lets a challenge through once', () => {
        const spent = new SpentChallenges();
        expect(spent.use('a', NOW + 1000, NOW)).toBe(true);
        expect(spent.use('a', NOW + 1000, NOW)).toBe(false);
        expect(spent.use('b', NOW + 1000, NOW)).toBe(true);
    });

    it('forgets a challenge once it has expired, when it could not be used anyway', () => {
        const spent = new SpentChallenges();
        spent.use('a', NOW + 1000, NOW);
        expect(spent.use('a', NOW + 5000, NOW + 2000)).toBe(true);
    });
});
