/**
 * Storage quota shown to each account.
 *
 * `User.maxQuota` keeps holding the per-user value, so an admin can still raise
 * somebody's limit from /admin/resources/User. What lives here is the floor:
 * every account gets at least DEFAULT_MAX_QUOTA_MB, so lifting the limit for
 * everyone is one environment variable in CapRover instead of a migration plus
 * an UPDATE over the users table (and it reaches accounts created long ago).
 *
 * Nothing rejects an upload over quota today: these numbers drive the bar on
 * /account and the avatar check in the browser. A per-user value *below* the
 * floor therefore has no effect, which only starts to matter the day uploads
 * actually check the quota.
 */

const MB = 1024 * 1024;

/** Used when DEFAULT_MAX_QUOTA_MB is unset or not a usable number. */
export const DEFAULT_MAX_QUOTA_MB = 500;

/** The floor, in bytes. Read at call time so a test can change the env var. */
export function quotaFloorBytes(raw: string | undefined = process.env.DEFAULT_MAX_QUOTA_MB): number {
    const mb = Number(raw);
    if (!Number.isFinite(mb) || mb <= 0) return DEFAULT_MAX_QUOTA_MB * MB;
    return Math.floor(mb * MB);
}

/** What to show for an account whose column says `stored` bytes. */
export function effectiveMaxQuota(stored: number | null | undefined, raw?: string): number {
    return Math.max(stored ?? 0, quotaFloorBytes(raw));
}
