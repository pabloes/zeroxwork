import { prisma } from '../db/index.js';

/** Hard ceiling, so a malformed payload cannot write thousands of rows. */
export const MAX_CREDITS = 20;
const NAME_MAX = 60;
const ROLE_MAX = 40;

export interface CreditInput {
    name?: unknown;
    role?: unknown;
    userId?: unknown;
    handle?: unknown;
}

interface CleanCredit {
    name: string;
    role: string | null;
    userId: number | null;
}

export class CreditError extends Error {}

/**
 * Normalises what the article form sends into rows we can store.
 *
 * A credit always keeps a `name`, so collaborators with no ZEROxWORK account
 * can be credited too. `userId` (resolved here from the handle the picker sent)
 * is what turns that name into a link to /member/<handle>.
 *
 * Names are deduplicated case-insensitively because article_credits is unique
 * on (articleId, name): two "Carlos" would otherwise fail the whole save.
 *
 * Project members go through here too: project_members has the same shape and
 * the same unique rule, and the one difference -- a project needs at least one
 * -- is the route's business, not this function's.
 */
export async function normaliseCredits(input: unknown): Promise<CleanCredit[]> {
    if (input === undefined || input === null) return [];
    if (!Array.isArray(input)) throw new CreditError('credits must be a list');
    if (input.length > MAX_CREDITS) throw new CreditError(`At most ${MAX_CREDITS} people on one entry`);

    const wanted: { name: string; role: string | null; userId: number | null; handle: string | null }[] = [];
    const seen = new Set<string>();

    for (const raw of input as CreditInput[]) {
        const name = typeof raw?.name === 'string' ? raw.name.trim() : '';
        if (name === '') continue;
        if (name.length > NAME_MAX) throw new CreditError(`Credit name is too long (max ${NAME_MAX})`);

        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);

        const role = typeof raw?.role === 'string' && raw.role.trim() !== '' ? raw.role.trim() : null;
        if (role && role.length > ROLE_MAX) throw new CreditError(`Credit role is too long (max ${ROLE_MAX})`);

        const userId = Number.isInteger(raw?.userId) ? Number(raw.userId) : null;
        const handle = typeof raw?.handle === 'string' && raw.handle.trim() !== ''
            ? raw.handle.trim().toLowerCase()
            : null;

        wanted.push({ name, role, userId, handle });
    }

    // Resolve handles in one query, and drop any userId that no longer exists:
    // a stale id would fail the foreign key and take the whole save with it.
    const handles = wanted.map((c) => c.handle).filter((h): h is string => h !== null);
    const ids = wanted.map((c) => c.userId).filter((id): id is number => id !== null);

    type UserRef = { id: number; handle: string | null };
    let users: UserRef[] = [];
    if (handles.length > 0 || ids.length > 0) {
        users = await prisma.user.findMany({
            where: { OR: [{ handle: { in: handles } }, { id: { in: ids } }] },
            select: { id: true, handle: true },
        });
    }

    const byHandle = new Map<string, number>();
    const knownIds = new Set<number>();
    for (const user of users) {
        knownIds.add(user.id);
        if (user.handle) byHandle.set(user.handle, user.id);
    }

    return wanted.map(({ name, role, userId, handle }) => {
        const linked = handle !== null ? byHandle.get(handle) ?? null : null;
        return {
            name,
            role,
            userId: linked ?? (userId !== null && knownIds.has(userId) ? userId : null),
        };
    });
}
