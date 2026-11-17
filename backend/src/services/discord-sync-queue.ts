import { prisma } from '../db';

/**
 * Why a member needs looking at. It matters: the bot only takes a role away for
 * 'unlinked' and 'grant_changed', and only from the account the row names. A
 * role nobody queued a removal for is never touched, so one given by hand in
 * Discord stays.
 */
export type SyncReason = 'linked' | 'unlinked' | 'grant_changed';

/**
 * Ask the bot to re-check one Discord account.
 *
 * Never throws: a queue problem must not break linking for the person doing
 * it. A link that fails to queue still gets its role on the bot's next pass.
 * An unlink that fails to queue does not lose it: nothing else removes roles.
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
