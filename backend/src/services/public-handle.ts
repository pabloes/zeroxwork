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
