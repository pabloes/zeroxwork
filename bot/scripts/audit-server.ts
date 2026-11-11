/**
 * Read-only snapshot of the server's safety settings and channel permissions.
 * Changes nothing: it only reports what is there so decisions are made on
 * facts instead of assumptions.
 *
 *   cd bot && npx tsx scripts/audit-server.ts
 */
import { Client, GatewayIntentBits, PermissionFlagsBits, ChannelType } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

const token = process.env.DISCORD_BOT_TOKEN?.trim();
const guildId = process.env.DISCORD_GUILD_ID?.trim();
if (!token || !guildId) {
    console.error('Set DISCORD_BOT_TOKEN and DISCORD_GUILD_ID in bot/.env first.');
    process.exit(1);
}

const VERIFICATION = ['none', 'low (verified email)', 'medium (account > 5 min)', 'high (member > 10 min)', 'very high (verified phone)'];
const FILTER = ['disabled', 'members without roles', 'everyone'];

// the permissions that decide how much damage a fresh account can do
const RISKY = [
    ['Send Messages', PermissionFlagsBits.SendMessages],
    ['Embed Links', PermissionFlagsBits.EmbedLinks],
    ['Attach Files', PermissionFlagsBits.AttachFiles],
    ['Mention Everyone', PermissionFlagsBits.MentionEveryone],
    ['Create Invite', PermissionFlagsBits.CreateInstantInvite],
    ['Use External Emojis', PermissionFlagsBits.UseExternalEmojis],
    ['Add Reactions', PermissionFlagsBits.AddReactions],
] as const;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('clientReady', async () => {
    try {
        const guild = await client.guilds.fetch(guildId);
        const full = await guild.fetch();

        console.log(`\n=== ${full.name}`);
        console.log(`Members: ${full.memberCount}`);
        console.log(`Verification level: ${VERIFICATION[full.verificationLevel] ?? full.verificationLevel}`);
        console.log(`Explicit content filter: ${FILTER[full.explicitContentFilter] ?? full.explicitContentFilter}`);
        console.log(`Community features enabled: ${full.features.includes('COMMUNITY') ? 'yes' : 'NO'}`);
        console.log(`Features: ${full.features.join(', ') || 'none'}`);
        console.log(`Rules channel: ${full.rulesChannel?.name ?? 'none'}`);

        const everyone = full.roles.everyone;
        console.log('\n=== @everyone, server-wide');
        for (const [label, flag] of RISKY) {
            console.log(`  ${everyone.permissions.has(flag) ? 'ALLOWED ' : 'denied  '} ${label}`);
        }

        console.log('\n=== Channels and who can see them');
        const channels = await full.channels.fetch();
        for (const channel of [...channels.values()].filter(Boolean).sort((a, b) => (a!.rawPosition ?? 0) - (b!.rawPosition ?? 0))) {
            if (!channel || channel.type === ChannelType.GuildCategory) continue;
            const overwrites = 'permissionOverwrites' in channel ? channel.permissionOverwrites.cache : null;
            const everyoneOverwrite = overwrites?.get(full.id);
            const hiddenFromEveryone = everyoneOverwrite?.deny.has(PermissionFlagsBits.ViewChannel) ?? false;
            const mutedForEveryone = everyoneOverwrite?.deny.has(PermissionFlagsBits.SendMessages) ?? false;

            const state = hiddenFromEveryone ? 'members only' : mutedForEveryone ? 'public, read-only' : 'PUBLIC, anyone writes';
            const kind = channel.type === ChannelType.GuildVoice ? 'voice' : 'text ';
            const slowmode = 'rateLimitPerUser' in channel && channel.rateLimitPerUser ? `, slowmode ${channel.rateLimitPerUser}s` : '';
            console.log(`  ${kind} ${channel.name.padEnd(18)} ${state}${slowmode}`);
        }
        console.log();
    } catch (error) {
        console.error('Failed:', error instanceof Error ? error.message : error);
    } finally {
        client.destroy();
    }
});

client.login(token).catch((error) => {
    console.error('Login failed:', error.message);
    process.exit(1);
});
