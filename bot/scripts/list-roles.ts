/**
 * Prints every role in the guild with its id, and whether the bot could manage
 * it. Saves hunting for ids by hand, and answers the question that actually
 * matters before anything else: is the bot's own role high enough?
 *
 *   cd bot && npx tsx scripts/list-roles.ts
 *
 * Needs DISCORD_BOT_TOKEN and DISCORD_GUILD_ID. Read-only: it changes nothing.
 */
import { Client, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';
import { DISCORD_ROLES } from '../../backend/src/constants/discord-roles';

dotenv.config();

const token = process.env.DISCORD_BOT_TOKEN?.trim();
const guildId = process.env.DISCORD_GUILD_ID?.trim();

if (!token || !guildId) {
    console.error('Set DISCORD_BOT_TOKEN and DISCORD_GUILD_ID in bot/.env first.');
    process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('clientReady', async () => {
    try {
        const guild = await client.guilds.fetch(guildId);
        const roles = await guild.roles.fetch();
        const me = await guild.members.fetchMe();
        const botTop = me.roles.highest;

        console.log(`\nGuild: ${guild.name}`);
        console.log(`Bot's highest role: ${botTop.name} (position ${botTop.position})\n`);

        const sorted = [...roles.values()].sort((a, b) => b.position - a.position);
        console.log('position  manageable  id                    name');
        for (const role of sorted) {
            if (role.id === guild.id) continue; // @everyone
            const manageable = !role.managed && botTop.comparePositionTo(role) > 0;
            const why = role.managed ? 'integration' : manageable ? 'yes' : 'ABOVE BOT';
            console.log(`${String(role.position).padStart(8)}  ${why.padEnd(11)} ${role.id.padEnd(21)} ${role.name}`);
        }

        console.log('\nSuggested bot/.env lines (fill in the ids you want):');
        for (const definition of DISCORD_ROLES) {
            const match = sorted.find((role) => !role.managed && role.name.toLowerCase().includes(definition.label.toLowerCase()));
            console.log(`${definition.env}=${match?.id ?? ''}${match ? '' : '   # no role matched "' + definition.label + '"'}`);
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
