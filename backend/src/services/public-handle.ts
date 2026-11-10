/**
 * Assigns the public handle that /member/<handle> lives at.
 *
 * Called at registration, when a Discord account is linked and when on-chain
 * names are refreshed, so an account always has a page and gets a better
 * address as soon as a real name shows up. It never touches a handle that is
 * not the automatic `member-<id>` one: beyond that point the handle is a URL
 * somebody may have shared, and the member can still change it on /account.
 */

import { prisma } from '../db/index.js';
import { autoHandle, handleCandidates, isAutoHandle, PublicNameSources } from '../config/public-name.js';
import { HANDLE_MAX } from '../config/profile.js';

/** Everything the candidate list needs, in one query. */
const SOURCES_SELECT = {
    id: true,
    displayName: true,
    handle: true,
    discordLink: { select: { globalName: true, username: true } },
    defaultName: { select: { name: true } },
} as const;

/**
 * The handle this account should have. Returns the stored one untouched when it
 * is already a real handle, and null only if the account does not exist.
 */
export async function ensureHandle(userId: number): Promise<string | null> {
    let user: PublicNameSources | null;
    try {
        user = await prisma.user.findUnique({ where: { id: userId }, select: SOURCES_SELECT }) as PublicNameSources | null;
    } catch (error) {
        // Never the reason a registration or a Discord link fails.
        console.error('ensureHandle: could not read user', userId, error);
        return null;
    }
    if (!user) return null;

    if (user.handle && !isAutoHandle(user.handle)) return user.handle;

    for (const candidate of handleCandidates(user)) {
        if (candidate === user.handle) return candidate; // already the best available
        try {
            const taken = await prisma.user.findFirst({
                where: { handle: candidate, id: { not: userId } },
                select: { id: true },
            });
            if (taken) continue;

            const updated = await prisma.user.update({
                where: { id: userId },
                data: { handle: candidate },
                select: { handle: true },
            });
            return updated.handle;
        } catch (error: any) {
            // P2002 is the unique index refusing a handle another request just
            // claimed. Any candidate can lose that race, so try the next one;
            // autoHandle() closes the list and cannot collide.
            if (error?.code === 'P2002') continue;
            console.error('ensureHandle: could not set handle for user', userId, error);
            return user.handle ?? null;
        }
    }

    return user.handle ?? autoHandle(userId);
}

/**
 * Fire-and-forget version for request paths that must not slow down or fail
 * because of the handle: registration, the Discord callback, the name sync.
 */
export function ensureHandleInBackground(userId: number): void {
    ensureHandle(userId).catch((error) => console.error('ensureHandle failed for user', userId, error));
}

/**
 * The same handle when nobody has it, or the first free `<handle>-N` when
 * somebody does.
 *
 * The registration form already suggests a free handle while the member types,
 * but that answer is a snapshot: two people can be told the same handle is free
 * and both submit it. So the check runs again here, where the unique index is,
 * and the loser of the race gets a suffix instead of a failed registration.
 *
 * `desired` must have been through validateHandle already: this only resolves
 * collisions, it does not sanitise. Returns null only when the database cannot
 * be read, so the caller can decide whether that is fatal.
 */
export async function freeHandle(desired: string, excludeUserId?: number): Promise<string | null> {
    // Leave room for the longest suffix we may need, so the result never gets
    // cut past HANDLE_MAX and collides with a different base.
    const base = desired.slice(0, HANDLE_MAX - 4).replace(/-+$/, '') || desired;

    const candidates = [desired];
    for (let n = 2; n <= 99; n++) candidates.push(`${base}-${n}`);

    try {
        for (const candidate of candidates) {
            const taken = await prisma.user.findFirst({
                where: {
                    handle: candidate,
                    ...(excludeUserId === undefined ? {} : { id: { not: excludeUserId } }),
                },
                select: { id: true },
            });
            if (!taken) return candidate;
        }
        // 99 people with the same name is not a collision any more, it is a
        // pattern: fall back to something that cannot keep colliding.
        return `${base}-${Date.now().toString(36).slice(-4)}`;
    } catch (error) {
        console.error('freeHandle: could not check handles for', desired, error);
        return null;
    }
}
