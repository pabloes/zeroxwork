import { prisma } from '../db';

/** Why a member needs looking at. Informational: the bot always recomputes from scratch. */
export type SyncReason = 'linked' | 'unlinked' | 'grant_changed';

/**
 * Ask the bot to re-check one Discord account.
 *
 * Never throws: queueing is a convenience on top of the periodic reconcile, so
 * a queue problem must not break linking for the person doing it. Worst case
 * the role lands on the next reconcile instead of in a few seconds.
 */
export async function enqueueDiscordSync(discordId: string, reason: SyncReason): Promise<void> {
    try {
        await prisma.discordSyncJob.create({ data: { discordId, reason } });
    } catch (error) {
        console.error(`Could not queue Discord sync (${reason}); the reconcile will catch it`);
    }
}

/**
 * Same, for a ZEROxWORK user: looks up their linked Discord account first.
 * Used when a role grant changes in the admin panel.
 */
export async function enqueueDiscordSyncForUser(userId: number, reason: SyncReason): Promise<void> {
    try {
        const link = await prisma.discordLink.findUnique({
            where: { userId },
            select: { discordId: true },
        });
        if (link) await enqueueDiscordSync(link.discordId, reason);
    } catch (error) {
        console.error('Could not queue Discord sync for user; the reconcile will catch it');
    }
}
