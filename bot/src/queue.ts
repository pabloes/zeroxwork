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
}

export interface JobPlan {
    /** one entry per account, even when several rows piled up for it */
    discordIds: string[];
    /** rows backing each account, so they can be deleted together once applied */
    rowsByDiscordId: Map<string, number[]>;
    /** rows that failed too many times: dropped, the reconcile is the backstop */
    giveUp: number[];
}

export const MAX_ATTEMPTS = 5;

/**
 * Several rows for the same account collapse into one sync: the bot always
 * recomputes the full desired state, so applying it twice changes nothing.
 */
export function planJobs(jobs: SyncJob[], maxAttempts = MAX_ATTEMPTS): JobPlan {
    const rowsByDiscordId = new Map<string, number[]>();
    const giveUp: number[] = [];

    for (const job of jobs) {
        if (job.attempts >= maxAttempts) {
            giveUp.push(job.id);
            continue;
        }
        const rows = rowsByDiscordId.get(job.discordId);
        if (rows) rows.push(job.id);
        else rowsByDiscordId.set(job.discordId, [job.id]);
    }

    return {
        discordIds: [...rowsByDiscordId.keys()],
        rowsByDiscordId,
        giveUp,
    };
}
