import { Client, Events, GatewayIntentBits, TextChannel } from 'discord.js';
import { PrismaClient } from './db';
import { loadConfig } from './config';
import { hasRolePermission, manageableRoleIds, reconcileGuild, syncMember } from './sync';
import { isNoop } from './roles';

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
 * Links touched since their last sync. Covers new links and changed grants;
 * unlinks are caught by the full reconcile, since a deleted row cannot be polled.
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
    if (!hasRolePermission(guild)) {
        console.error('The bot is missing the Manage Roles permission; nothing will be applied.');
        return;
    }

    const { unreachable } = manageableRoleIds(guild, config);
    if (unreachable.length) {
        await log(`Roles out of reach: ${unreachable.join(', ')}. Move the bot's role above them.`);
    }

    await fullReconcile();
    setInterval(() => void fastPass().catch((e) => console.error('Fast pass failed:', e.message)), config.fastPassMs);
    setInterval(() => void fullReconcile().catch((e) => console.error('Reconcile failed:', e.message)), config.reconcileMs);
});

// someone linked on the site before joining: give them their roles on arrival
client.on(Events.GuildMemberAdd, async (member) => {
    if (member.guild.id !== config.guildId || member.user.bot) return;
    const { managed } = manageableRoleIds(member.guild, config);
    if (managed.size === 0) return;

    const outcome = await syncMember(member, prisma, config, managed);
    if (!isNoop(outcome.applied)) {
        await log(`${member.user.tag} joined with a linked account, roles applied`);
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
