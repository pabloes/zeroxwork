/**
 * Finding an account by the address somebody typed.
 *
 * New accounts are stored lower case, but the ones that were there before are
 * stored exactly as they were typed, capitals included. Looking those up by
 * the normalised address alone would lock their owners out, so the search
 * widens in steps and stops at the first hit:
 *
 *   1. exactly as typed
 *   2. normalised
 *   3. ignoring case
 */
import { prisma } from '../db/index.js';
import { normalizeEmail } from '../config/profile.js';

export async function findUserByEmail(raw: unknown) {
    if (typeof raw !== 'string') return null;
    const typed = raw.trim();
    if (typed === '') return null;

    // Before any rule about what an address looks like: an account that got in
    // under the old, looser sign-up must still be found by what its owner types.
    const exact = await prisma.user.findUnique({ where: { email: typed } });
    if (exact) return exact;

    const normalized = normalizeEmail(typed);
    if (!normalized) return null;

    if (typed !== normalized) {
        const lower = await prisma.user.findUnique({ where: { email: normalized } });
        if (lower) return lower;
    }

    const anyCase = await prisma.user.findFirst({
        where: { email: { equals: normalized, mode: 'insensitive' } },
        orderBy: { id: 'asc' },
    });
    // Belt and braces: an insensitive match is a pattern match underneath, and
    // `_` is legal in an address. Never hand back a row that is not this address.
    return anyCase && anyCase.email.toLowerCase() === normalized ? anyCase : null;
}
