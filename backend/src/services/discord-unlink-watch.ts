/**
 * Which Discord accounts are about to lose their link, for any reason.
 *
 * The bot takes a role away only when it is told that a link went. It used to
 * work that out on its own, by comparing the members with the links every
 * quarter of an hour, and that is what stripped the role from people the owner
 * had let in by hand. So now somebody has to tell it, every time, by every
 * road: the unlink button, a link or a user deleted in /admin, an account
 * merged by a script, a Discord account swapped for another on the same user.
 *
 * Watching the database client covers all of them at once, including the ones
 * nobody has written yet. This file decides what to tell; db/index.ts does the
 * telling.
 *
 * Never throws: a failure here must not stop the delete it is watching.
 */
export interface UnlinkWatchDb {
    /** discord links matching a `where` of the DiscordLink model */
    linksWhere(where: unknown): Promise<{ discordId: string }[]>;
    /** discord links of the users matching a `where` of the User model */
    linksOfUsersWhere(where: unknown): Promise<{ discordId: string }[]>;
}

export interface WatchedQuery {
    model?: string;
    action: string;
    args?: any;
}

/** `discordId: 'x'` and `discordId: { set: 'x' }` are the same write. */
function writtenDiscordId(data: any): string | null {
    const value = data?.discordId;
    if (typeof value === 'string') return value;
    if (value && typeof value.set === 'string') return value.set;
    return null;
}

export async function discordIdsLosingTheirLink(query: WatchedQuery, db: UnlinkWatchDb): Promise<string[]> {
    const { model, action, args } = query;
    if (model !== 'DiscordLink' && model !== 'User') return [];

    try {
        if (model === 'User') {
            // the link goes with its user: the database deletes it in cascade
            if (action !== 'delete' && action !== 'deleteMany') return [];
            return (await db.linksOfUsersWhere(args?.where ?? {})).map((link) => link.discordId);
        }

        if (action === 'delete' || action === 'deleteMany') {
            return (await db.linksWhere(args?.where ?? {})).map((link) => link.discordId);
        }

        // The same user linking a different Discord account: the old one is
        // left without a link, although no row is deleted.
        if (action === 'update' || action === 'upsert') {
            const next = writtenDiscordId(action === 'upsert' ? args?.update : args?.data);
            if (!next) return [];
            return (await db.linksWhere(args?.where ?? {}))
                .map((link) => link.discordId)
                .filter((discordId) => discordId !== next);
        }
    } catch (error) {
        console.error('Could not work out which Discord links are going: a role may have to be taken off by hand');
    }
    return [];
}
