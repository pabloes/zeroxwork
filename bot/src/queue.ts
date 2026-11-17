/**
 * Draining the work queue the website writes to.
 *
 * The decisions here are pure: what to sync, what to delete, what to retry.
 * Anything touching Discord or the database lives in index.ts.
 */

export interface SyncJob {
    id: number;
    discordId: string;
    attempts: number;
    /** why the website queued it: 'linked', 'unlinked' or 'grant_changed' */
    reason?: string | null;
}

/**
 * The reasons that allow taking a role away. An unlink removes what the link
 * gave; an edited grant removes the role it no longer covers. A new link only
 * ever adds.
 */
export const REMOVAL_REASONS: ReadonlySet<string> = new Set(['unlinked', 'grant_changed']);

export interface JobPlan {
    /** one entry per account, even when several rows piled up for it */
    discordIds: string[];
    /** rows backing each account, so they can be deleted together once applied */
    rowsByDiscordId: Map<string, number[]>;
    /** rows that failed too many times: dropped */
    giveUp: number[];
    /** accounts the website asked to take something away from: only these may lose a role */
    mayRemove: Set<string>;
}

export const MAX_ATTEMPTS = 5;

/**
 * Several rows for the same account collapse into one sync: the bot always
 * recomputes the full desired state, so applying it twice changes nothing.
 */
export function planJobs(jobs: SyncJob[], maxAttempts = MAX_ATTEMPTS): JobPlan {
    const rowsByDiscordId = new Map<string, number[]>();
    const giveUp: number[] = [];
    const mayRemove = new Set<string>();

    for (const job of jobs) {
        if (job.attempts >= maxAttempts) {
            giveUp.push(job.id);
            continue;
        }
        const rows = rowsByDiscordId.get(job.discordId);
        if (rows) rows.push(job.id);
        else rowsByDiscordId.set(job.discordId, [job.id]);
        // one such row among several is enough: they collapse into a single sync
        if (job.reason && REMOVAL_REASONS.has(job.reason)) mayRemove.add(job.discordId);
    }

    return {
        discordIds: [...rowsByDiscordId.keys()],
        rowsByDiscordId,
        giveUp,
        mayRemove,
    };
}
