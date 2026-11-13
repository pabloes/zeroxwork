/**
 * A sign-up has to cost something, or a script creates accounts for free and
 * every account is a key to the Discord server.
 *
 * This is proof of work, not a puzzle: the browser is handed a hash and has to
 * find the number behind it, which takes a second or two of its time and none
 * of the person's. It does not stop somebody who writes a solver; it makes
 * each account cost them a second of processor instead of nothing, and it
 * turns away anything that posts to the API without running our page.
 *
 * No third party, no cookie, nothing about the visitor leaves the site. If
 * that ever stops being enough, this is the seam where a stronger check goes.
 *
 * Pure: the secret comes in as an argument. Remembering which challenges were
 * already used is the only state, and it lives in SpentChallenges.
 */
import crypto from 'crypto';

/** The answer lies between 0 and this. About a second of hashing in a browser. */
export const HUMAN_CHECK_MAX_NUMBER = 100_000;
/** Long enough to fill in the form, short enough that a solved one is not worth hoarding. */
export const HUMAN_CHECK_TTL_MS = 5 * 60 * 1000;

export interface HumanChallenge {
    algorithm: 'SHA-256';
    /** sha256(salt + number), hex. The browser looks for the number. */
    challenge: string;
    /** `<random>.<expires at, ms>.<max number>`: everything the check needs, all of it signed. */
    salt: string;
    maxNumber: number;
    signature: string;
}

export interface HumanSolution {
    challenge: string;
    salt: string;
    number: number;
    signature: string;
}

export type HumanCheckResult =
    | { ok: true; id: string; expiresAt: number }
    | { ok: false; reason: 'malformed' | 'forged' | 'expired' | 'wrong' };

function keyFor(secret: string): Buffer {
    return crypto.createHmac('sha256', secret).update('zeroxwork:human-check:v1').digest();
}

function sha256(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex');
}

function sign(secret: string, challenge: string, salt: string): string {
    return crypto.createHmac('sha256', keyFor(secret)).update(`${challenge}\n${salt}`).digest('hex');
}

export function createChallenge(
    secret: string,
    options: { now?: number; maxNumber?: number; ttlMs?: number; number?: number } = {},
): HumanChallenge {
    const maxNumber = options.maxNumber ?? HUMAN_CHECK_MAX_NUMBER;
    const expiresAt = (options.now ?? Date.now()) + (options.ttlMs ?? HUMAN_CHECK_TTL_MS);
    const salt = `${crypto.randomBytes(12).toString('hex')}.${expiresAt}.${maxNumber}`;
    const number = options.number ?? crypto.randomInt(0, maxNumber + 1);
    const challenge = sha256(salt + number);
    return { algorithm: 'SHA-256', challenge, salt, maxNumber, signature: sign(secret, challenge, salt) };
}

const HEX_64 = /^[0-9a-f]{64}$/;

export function verifySolution(secret: string, raw: unknown, now = Date.now()): HumanCheckResult {
    if (!raw || typeof raw !== 'object') return { ok: false, reason: 'malformed' };
    const { challenge, salt, number, signature } = raw as Record<string, unknown>;
    if (
        typeof challenge !== 'string' || !HEX_64.test(challenge)
        || typeof signature !== 'string' || !HEX_64.test(signature)
        || typeof salt !== 'string' || salt.length > 80
        || typeof number !== 'number' || !Number.isInteger(number)
    ) {
        return { ok: false, reason: 'malformed' };
    }

    // The signature first: nothing inside the salt is believed until it holds.
    const expected = sign(secret, challenge, salt);
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
        return { ok: false, reason: 'forged' };
    }

    const [, expiresText, maxText] = salt.split('.');
    const expiresAt = Number(expiresText);
    const maxNumber = Number(maxText);
    if (!Number.isFinite(expiresAt) || !Number.isFinite(maxNumber)) return { ok: false, reason: 'forged' };
    if (now > expiresAt) return { ok: false, reason: 'expired' };
    if (number < 0 || number > maxNumber || sha256(salt + number) !== challenge) return { ok: false, reason: 'wrong' };

    return { ok: true, id: signature, expiresAt };
}

/**
 * A solved challenge is good for one sign-up. Without this, one second of work
 * would pay for as many accounts as fit in five minutes.
 *
 * In memory, which is enough for one process: a restart forgets at most five
 * minutes of challenges, and each of those was already used once.
 */
export class SpentChallenges {
    private readonly spent = new Map<string, number>();

    /** True the first time, false for every repeat until the challenge expires. */
    use(id: string, expiresAt: number, now = Date.now()): boolean {
        for (const [seen, until] of this.spent) {
            if (until < now) this.spent.delete(seen);
        }
        if (this.spent.has(id)) return false;
        this.spent.set(id, expiresAt);
        return true;
    }
}
