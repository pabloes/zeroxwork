import { api } from './axios-setup';

/**
 * The work the server asks for before it creates an account.
 *
 * It hands over a hash and a salt; we look for the number that produces that
 * hash and send it back with the form. About a second of this browser's time
 * and none of the person's: no puzzle, no third party, nothing to click.
 *
 * It does not prove there is a person. It makes an account cost something to
 * whoever is creating them by the thousand. The rules live on the server, in
 * backend/src/services/human-check.ts.
 */
export interface HumanSolution {
    challenge: string;
    salt: string;
    number: number;
    signature: string;
}

interface HumanChallenge extends Omit<HumanSolution, 'number'> {
    maxNumber: number;
}

function hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    return bytes;
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
}

/** Fetches a challenge and solves it. Rejects if the server gave one with no answer in range. */
export async function solveHumanCheck(): Promise<HumanSolution> {
    const { data } = await api.get<HumanChallenge>('/auth/human-check');
    const target = hexToBytes(data.challenge);
    const encoder = new TextEncoder();

    for (let number = 0; number <= data.maxNumber; number++) {
        // Each digest is awaited, so the page keeps painting while this runs.
        const digest = await crypto.subtle.digest('SHA-256', encoder.encode(data.salt + number));
        if (sameBytes(new Uint8Array(digest), target)) {
            return { challenge: data.challenge, salt: data.salt, number, signature: data.signature };
        }
    }
    throw new Error('human check: no number matches');
}
