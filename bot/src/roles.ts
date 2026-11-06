/**
 * Role decisions, with no network and no database: everything here is a pure
 * function of the state passed in, which is what makes it testable.
 *
 * The rule that matters: the bot only ever removes roles it manages. A member's
 * moderator role, or anything handed out by another bot, is invisible to it.
 */

export interface LinkState {
    /** role keys granted by hand in the admin panel */
    grantedRoleKeys: string[];
}

export interface RoleDiff {
    add: string[];
    remove: string[];
}

/** Role key granted by the link itself, with no admin intervention. */
export const BASE_ROLE_KEY = 'zeroxwork';

/**
 * Which Discord role ids a member should end up with.
 * No link means no roles: that is what makes unlinking revoke them.
 */
export function desiredRoleIds(link: LinkState | null | undefined, roleIds: Map<string, string>): Set<string> {
    const desired = new Set<string>();
    if (!link) return desired;

    const baseId = roleIds.get(BASE_ROLE_KEY);
    if (baseId) desired.add(baseId);

    for (const key of link.grantedRoleKeys) {
        const id = roleIds.get(key);
        // a key with no configured id is skipped, never guessed
        if (id) desired.add(id);
    }
    return desired;
}

/**
 * What to change on a member.
 * `managed` is the full set of ids the bot is allowed to touch; anything
 * outside it is left exactly as it is, both for adding and for removing.
 */
export function roleDiff(currentRoleIds: Iterable<string>, desired: Set<string>, managed: Set<string>): RoleDiff {
    const current = new Set(currentRoleIds);

    const add: string[] = [];
    for (const id of desired) {
        if (managed.has(id) && !current.has(id)) add.push(id);
    }

    const remove: string[] = [];
    for (const id of current) {
        if (managed.has(id) && !desired.has(id)) remove.push(id);
    }

    return { add, remove };
}

export function isNoop(diff: RoleDiff): boolean {
    return diff.add.length === 0 && diff.remove.length === 0;
}
