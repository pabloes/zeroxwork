import { ChannelType, ComponentType, PermissionFlagsBits, type Guild, type Message } from 'discord.js';
import { buildWelcomeMessage, parseWelcomeCustomId, type WelcomeMessage } from './welcome';

function welcomeButtons(message: Message): { customId: string; label: string }[] {
    const buttons: { customId: string; label: string }[] = [];
    for (const row of message.components) {
        if (row.type !== ComponentType.ActionRow) continue;
        for (const component of row.components) {
            if (component.type !== ComponentType.Button || !component.customId) continue;
            buttons.push({ customId: component.customId, label: component.label ?? '' });
        }
    }
    return buttons;
}

function isWelcomeMessage(message: Message, botId: string): boolean {
    return message.author.id === botId
        && welcomeButtons(message).some((button) => parseWelcomeCustomId(button.customId) !== null);
}

function sameAsPublished(message: Message, wanted: WelcomeMessage): boolean {
    if (message.content !== wanted.content) return false;
    const published = welcomeButtons(message).map((button) => `${button.customId}|${button.label}`);
    const expected = wanted.components[0].components.map((button) => `${button.custom_id}|${button.label}`);
    return published.length === expected.length && published.every((value, index) => value === expected[index]);
}

/**
 * Keep exactly one, current welcome message in the rules channel.
 *
 * It runs when the bot starts, for two reasons: the buttons only exist while
 * the code that answers them is running, and a change to the text ships with a
 * deploy instead of someone editing a message by hand.
 *
 * Never throws for the expected "not set up" cases; it says what it did instead.
 */
export async function ensureWelcomeMessage(guild: Guild): Promise<string> {
    const channel = guild.rulesChannel;
    if (!channel || channel.type !== ChannelType.GuildText) {
        return 'Welcome not published: the server has no rules channel set';
    }

    const me = guild.members.me ?? await guild.members.fetchMe();
    const needed = [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
    ];
    if (!channel.permissionsFor(me).has(needed)) {
        return `Welcome not published: the bot cannot write in #${channel.name}`;
    }

    const wanted = buildWelcomeMessage();
    const recent = await channel.messages.fetch({ limit: 50 });
    const existing = recent.find((message) => isWelcomeMessage(message, me.id));

    if (!existing) {
        await channel.send({ ...wanted, allowedMentions: { parse: [] } });
        return `Welcome published in #${channel.name}`;
    }
    if (sameAsPublished(existing, wanted)) {
        return 'Welcome already up to date';
    }
    await existing.edit({ content: wanted.content, components: wanted.components });
    return `Welcome updated in #${channel.name}`;
}
