import dotenv from 'dotenv';
import { resolveRoleIds } from '../../backend/src/constants/discord-roles';
import { DEFAULT_MODEL } from './devlog.js';
import { WEEK_MS } from './repo-watch.js';

// the bot runs as its own CapRover app, so it reads its own .env in development
dotenv.config();

/** The weekly devlog watcher. Which repositories it looks at lives in the database. */
export interface RepoWatchConfig {
    /** Needed for a private repository, and raises the rate limit for a public one. */
    githubToken: string | null;
    /** Without it the posts are the plain list of commit subjects. */
    anthropicKey: string | null;
    model: string;
    /**
     * On by default. A bot that writes to a community on its own is worth
     * reading for a few weeks before it speaks in public, so the draft goes to
     * the log channel until somebody sets this to false on purpose.
     */
    dryRun: boolean;
    /** how long a repository waits between looks */
    everyMs: number;
    /** how often the bot looks for a repository whose week is up */
    passMs: number;
}

export interface BotConfig {
    token: string;
    guildId: string;
    roleIds: Map<string, string>;
    logChannelId: string | null;
    /** how often to drain the queue the website writes to */
    queueMs: number;
    /** how often to pick up links changed since the last sync */
    fastPassMs: number;
    /** how often to walk every member, which is what catches unlinks */
    reconcileMs: number;
    repoWatch: RepoWatchConfig;
}

function requireEnv(name: string): string {
    const value = process.env[name]?.trim();
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

function optionalEnv(name: string): string | null {
    return process.env[name]?.trim() || null;
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
        logChannelId: optionalEnv('DISCORD_LOG_CHANNEL_ID'),
        queueMs: Number(process.env.DISCORD_QUEUE_MS ?? 5_000),
        fastPassMs: Number(process.env.DISCORD_FAST_PASS_MS ?? 300_000),
        reconcileMs: Number(process.env.DISCORD_RECONCILE_MS ?? 900_000),
        repoWatch: {
            githubToken: optionalEnv('GITHUB_TOKEN'),
            anthropicKey: optionalEnv('ANTHROPIC_API_KEY'),
            model: optionalEnv('DEVLOG_MODEL') ?? DEFAULT_MODEL,
            // anything but an explicit "false" keeps the drafts private
            dryRun: (process.env.REPO_WATCH_DRY_RUN?.trim().toLowerCase() ?? 'true') !== 'false',
            everyMs: Number(process.env.REPO_WATCH_EVERY_MS ?? WEEK_MS),
            passMs: Number(process.env.REPO_WATCH_PASS_MS ?? 3_600_000),
        },
    };
}
