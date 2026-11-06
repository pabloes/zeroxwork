/**
 * Discord roles the bot is allowed to manage. Anything not listed here is never
 * touched, which is what keeps a bug from stripping moderators of their roles.
 *
 * `key` is what gets stored in discord_role_grants; the real Discord role id
 * lives in an environment variable, so ids never end up in the repository and
 * the test server can use different ones from production.
 */
export interface DiscordRoleDefinition {
    /** stored in the database and shown in the admin panel */
    key: string;
    label: string;
    /** environment variable holding the Discord role id */
    env: string;
    /** granted by the link itself instead of by hand */
    automatic: boolean;
}

export const DISCORD_ROLES: readonly DiscordRoleDefinition[] = [
    {
        key: 'zeroxwork',
        label: 'ZEROxWORK',
        env: 'DISCORD_ROLE_ZEROXWORK',
        automatic: true,
    },
    {
        key: 'crash_city_participant',
        label: 'CRASH CITY Participant',
        env: 'DISCORD_ROLE_CRASH_CITY_PARTICIPANT',
        automatic: false,
    },
    {
        key: 'crash_city_creator',
        label: 'CRASH CITY Creator',
        env: 'DISCORD_ROLE_CRASH_CITY_CREATOR',
        automatic: false,
    },
];

/** Roles a human hands out from the admin panel. */
export const GRANTABLE_ROLES = DISCORD_ROLES.filter((role) => !role.automatic);

export function isGrantableRoleKey(key: string): boolean {
    return GRANTABLE_ROLES.some((role) => role.key === key);
}

export function findRole(key: string): DiscordRoleDefinition | undefined {
    return DISCORD_ROLES.find((role) => role.key === key);
}

/**
 * Role key to Discord role id, for the roles that are actually configured.
 * A role without its variable set is simply not managed, instead of crashing
 * the bot or, worse, being treated as "no role" and removed from everyone.
 */
export function resolveRoleIds(source: NodeJS.ProcessEnv = process.env): Map<string, string> {
    const resolved = new Map<string, string>();
    for (const role of DISCORD_ROLES) {
        const id = source[role.env]?.trim();
        if (id) resolved.set(role.key, id);
    }
    return resolved;
}
