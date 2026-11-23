import { ChannelType, Client, Events, GatewayIntentBits, MessageFlags, PermissionFlagsBits, TextChannel } from 'discord.js';
import { PrismaClient } from './db';
import { loadConfig } from './config';
import { hasRolePermission, manageableRoleIds, reconcileGuild, syncMember } from './sync';
import { isNoop } from './roles';
import { planJobs } from './queue';
import { parseWelcomeCustomId, pickAskChannel, renderWelcome } from './welcome';
import { ensureWelcomeMessage } from './welcome-publish';
import { sendJoinMail } from './join-mail.js';
import { repoWatchPass } from './repo-watch-run.js';

const config = loadConfig();
const prisma = new PrismaClient();

const client = new Client({
    // GuildMembers is privileged: enable it in the Developer Portal or the
    // member list comes back empty and nothing is ever reconciled
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

async function log(message: string): Promise<void> {
    console.log(message);
    if (!config.logChannelId) return;
    try {
        const channel = await client.channels.fetch(config.logChannelId);
        if (channel?.isTextBased()) {
            await (channel as TextChannel).send(message.slice(0, 1900));
        }
    } catch {
        // the log channel is a convenience, never a reason to stop syncing
    }
}

async function getGuild() {
    return client.guilds.fetch(config.guildId);
}

/**
 * Links touched since their last sync: new ones the queue missed. Only adds.
 */
async function fastPass(): Promise<void> {
    const guild = await getGuild();
    const { managed } = manageableRoleIds(guild, config);
    if (managed.size === 0) return;

    const pending = await prisma.discordLink.findMany({
        where: { OR: [{ lastSyncedAt: null }, { lastSyncedAt: { lt: prisma.discordLink.fields.updatedAt } }] },
        select: { discordId: true },
        take: 100,
    });

    for (const { discordId } of pending) {
        const member = await guild.members.fetch(discordId).catch(() => null);
        if (!member) continue; // linked but not in the server yet
        const outcome = await syncMember(member, prisma, config, managed);
        if (outcome.error) {
            await log(`Role sync failed for ${discordId}: ${outcome.error}`);
        } else if (!isNoop(outcome.applied)) {
            await log(`Roles updated for ${member.user.tag}: +${outcome.applied.add.length} -${outcome.applied.remove.length}`);
        }
    }
}

/**
 * Drain what the website queued. This is what makes linking and unlinking feel
 * immediate, and it is the only place a role is ever taken away: an unlink or
 * an edited grant, for the account the row names.
 */
async function drainQueue(): Promise<void> {
    const jobs = await prisma.discordSyncJob.findMany({
        orderBy: { createdAt: 'asc' },
        take: 50,
        select: { id: true, discordId: true, attempts: true, reason: true },
    });
    if (jobs.length === 0) return;

    const guild = await getGuild();
    const { managed } = manageableRoleIds(guild, config);
    const plan = planJobs(jobs);

    if (plan.giveUp.length) {
        await prisma.discordSyncJob.deleteMany({ where: { id: { in: plan.giveUp } } });
        await log(`Gave up on ${plan.giveUp.length} sync job(s). A link among them gets its role on the next reconcile; an unlink does not lose it, and has to be taken off by hand`);
    }
    if (managed.size === 0) return;

    for (const discordId of plan.discordIds) {
        const rows = plan.rowsByDiscordId.get(discordId) ?? [];
        const member = await guild.members.fetch(discordId).catch(() => null);

        if (!member) {
            // linked but not in the server: nothing to do, and nothing to retry
            await prisma.discordSyncJob.deleteMany({ where: { id: { in: rows } } });
            continue;
        }

        const outcome = await syncMember(member, prisma, config, managed, plan.mayRemove.has(discordId));
        if (outcome.error) {
            await prisma.discordSyncJob.updateMany({
                where: { id: { in: rows } },
                data: { attempts: { increment: 1 }, lastError: outcome.error.slice(0, 500) },
            });
            await log(`Role sync failed for ${member.user.tag}: ${outcome.error}`);
            continue;
        }

        await prisma.discordSyncJob.deleteMany({ where: { id: { in: rows } } });
        if (!isNoop(outcome.applied)) {
            await log(`Roles updated for ${member.user.tag}: +${outcome.applied.add.length} -${outcome.applied.remove.length}`);
        }
    }
}

async function runRepoWatch(): Promise<void> {
    await repoWatchPass(client, prisma, config, log)
        .catch((error) => console.error('Repo watch failed:', error instanceof Error ? error.message : 'unknown error'));
}

async function fullReconcile(): Promise<void> {
    const guild = await getGuild();
    const { changed, failed } = await reconcileGuild(guild, prisma, config);
    if (changed.length || failed.length) {
        await log(`Reconcile: ${changed.length} member(s) updated, ${failed.length} failed`);
    }
}

client.once(Events.ClientReady, async (ready) => {
    console.log(`Bot ready as ${ready.user.tag}`);

    const guild = await getGuild().catch(() => null);
    if (!guild) {
        console.error(`Cannot see guild ${config.guildId}. Is the bot invited?`);
        return;
    }
    // Independent of the role work below, so it goes first: the welcome is
    // worth having even if the bot could not manage a single role.
    await ensureWelcomeMessage(guild)
        .then((result) => console.log(result))
        .catch((error) => console.error('Welcome publish failed:', error instanceof Error ? error.message : 'unknown error'));

    // Before the role work, and before its early return: the devlog watcher
    // only reads the portfolio, GitHub and one channel, so a bot that cannot
    // manage a single role should still write devlogs. It used to sit below
    // the return under a comment claiming exactly this, which the placement
    // quietly contradicted. It paces itself from the database, so starting it
    // at boot is safe however often a deploy restarts the bot.
    void runRepoWatch();
    setInterval(() => void runRepoWatch(), config.repoWatch.passMs);

    if (!hasRolePermission(guild)) {
        console.error('The bot is missing the Manage Roles permission; nothing will be applied.');
        return;
    }

    const { unreachable } = manageableRoleIds(guild, config);
    if (unreachable.length) {
        await log(`Roles out of reach: ${unreachable.join(', ')}. Move the bot's role above them.`);
    }

    await fullReconcile();
    setInterval(() => void drainQueue().catch((e) => console.error('Queue drain failed:', e.message)), config.queueMs);
    setInterval(() => void fastPass().catch((e) => console.error('Fast pass failed:', e.message)), config.fastPassMs);
    setInterval(() => void fullReconcile().catch((e) => console.error('Reconcile failed:', e.message)), config.reconcileMs);
});

// Somebody new walked in: mail the owner, and if they had linked on the site
// before joining, give them their roles on arrival.
client.on(Events.GuildMemberAdd, async (member) => {
    if (member.guild.id !== config.guildId || member.user.bot) return;

    // The mail is for every arrival, linked or not, and it goes before the
    // roles and on its own: a dead SMTP must not cost somebody their roles,
    // and a role out of reach must not cost the notice.
    const link = await prisma.discordLink
        .findUnique({ where: { discordId: member.id }, select: { id: true } })
        .catch(() => null);

    const mailed = await sendJoinMail({
        tag: member.user.tag,
        id: member.id,
        guildName: member.guild.name,
        accountCreatedAt: member.user.createdAt ?? null,
        joinedAt: member.joinedAt,
        memberCount: member.guild.memberCount ?? null,
        linked: Boolean(link),
    }, (message) => void log(message));
    if (mailed === 'sent') {
        await log(`${member.user.tag} joined the server, notice mailed`);
    }

    const { managed } = manageableRoleIds(member.guild, config);
    if (managed.size === 0) return;

    const outcome = await syncMember(member, prisma, config, managed);
    if (!isNoop(outcome.applied)) {
        await log(`${member.user.tag} joined with a linked account, roles applied`);
    }
});

// Buttons under the welcome message: answer in the chosen language, and only to
// whoever pressed. Works for unlinked members too, which is the point.
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;
    const lang = parseWelcomeCustomId(interaction.customId);
    if (!lang) return;

    try {
        // What this person can write in decides where they are sent to ask:
        // their language's channel once linked, #help before that.
        const writable = interaction.inCachedGuild()
            ? [...interaction.guild.channels.cache.values()]
                .filter((channel) => channel.type === ChannelType.GuildText
                    && channel.permissionsFor(interaction.member)
                        .has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]))
                .map((channel) => ({ id: channel.id, name: channel.name }))
            : [];
        await interaction.reply({
            content: renderWelcome(lang, pickAskChannel(lang, writable)),
            flags: MessageFlags.Ephemeral,
            allowedMentions: { parse: [] },
        });
    } catch (error) {
        console.error('Welcome reply failed:', error instanceof Error ? error.message : 'unknown error');
    }
});

async function shutdown(signal: string): Promise<void> {
    console.log(`Received ${signal}, shutting down`);
    await prisma.$disconnect();
    client.destroy();
    process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

client.login(config.token).catch((error) => {
    console.error('Discord login failed:', error.message);
    process.exit(1);
});
