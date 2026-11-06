import dotenv from 'dotenv';
import { resolveRoleIds } from '../../backend/src/constants/discord-roles';

// the bot runs as its own CapRover app, so it reads its own .env in development
dotenv.config();

export interface BotConfig {
    token: string;
    guildId: string;
    roleIds: Map<string, string>;
    logChannelId: string | null;
    /** how often to pick up links changed since the last sync */
    fastPassMs: number;
    /** how often to walk every member, which is what catches unlinks */
    reconcileMs: number;
}

function requireEnv(name: string): string {
    const value = process.env[name]?.trim();
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

export function loadConfig(): BotConfig {
    const roleIds = resolveRoleIds();
    if (roleIds.size === 0) {
        throw new Error('No Discord role id configured: set at least DISCORD_ROLE_ZEROXWORK');
    }

    return {
        token: requireEnv('DISCORD_BOT_TOKEN'),
        guildId: requireEnv('DISCORD_GUILD_ID'),
        roleIds,
        logChannelId: process.env.DISCORD_LOG_CHANNEL_ID?.trim() || null,
        fastPassMs: Number(process.env.DISCORD_FAST_PASS_MS ?? 60_000),
        reconcileMs: Number(process.env.DISCORD_RECONCILE_MS ?? 3_600_000),
    };
}
