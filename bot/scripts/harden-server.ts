/**
 * Applies the agreed three-tier layout and the safety settings.
 *
 *   npx tsx scripts/harden-server.ts            # dry run, changes nothing
 *   npx tsx scripts/harden-server.ts --apply    # applies it
 *
 * Needs Manage Server and Manage Channels on the bot, on top of its usual
 * Manage Roles. Those two are meant to be granted for this run and taken away
 * afterwards: the bot does not need them to do its job.
 *
 * Idempotent and additive. It never deletes a channel, never removes a role
 * from anyone, and skips whatever is already in the desired state.
 */
import {
    AutoModerationActionType,
    AutoModerationRuleEventType,
    AutoModerationRuleTriggerType,
    ChannelType,
    Client,
    GatewayIntentBits,
    GuildExplicitContentFilter,
    GuildVerificationLevel,
    PermissionFlagsBits,
    type Guild,
    type TextChannel,
    type VoiceChannel,
} from 'discord.js';
import dotenv from 'dotenv';
import { HELP_CHANNEL_NAME, WELCOME_LANGS, generalChannelName, type WelcomeLang } from '../src/welcome';

dotenv.config();

const APPLY = process.argv.includes('--apply');
const token = process.env.DISCORD_BOT_TOKEN?.trim();
const guildId = process.env.DISCORD_GUILD_ID?.trim();
const memberRoleId = process.env.DISCORD_ROLE_ZEROXWORK?.trim();

if (!token || !guildId || !memberRoleId) {
    console.error('Need DISCORD_BOT_TOKEN, DISCORD_GUILD_ID and DISCORD_ROLE_ZEROXWORK in bot/.env.');
    process.exit(1);
}

interface ChannelSpec {
    name: string;
    /** The name it had before; a channel still called this is renamed, never duplicated. */
    was?: string;
    tier: 0 | 1 | 2 | 3 | 4;
    /** null: whatever topic the channel has is left alone. */
    topic: string | null;
    /** Created next to the first open channel, in its category. */
    lobby?: boolean;
}

/**
 * Each in its own language. Whoever has not linked reads these channels without
 * being able to write, and the topic is where they find out why.
 */
const GENERAL_TOPICS: Record<WelcomeLang, string> = {
    en: 'General chat in English. To write here, link your account at zeroxwork.com/account.',
    es: 'Chat general en español. Para escribir aquí, vincula tu cuenta en zeroxwork.com/account.',
    'pt-br': 'Chat geral em português. Para escrever aqui, vincule sua conta em zeroxwork.com/account.',
    zh: '中文综合聊天。要在这里发言，请先在 zeroxwork.com/account 绑定账号。',
    fr: 'Discussion générale en français. Pour écrire ici, liez votre compte sur zeroxwork.com/account.',
};

/**
 * Tiers 0, 1 and 4 are visible to everyone; tier 2 is the reason to link.
 * Names and topics are in English: a channel has one name for everybody, and
 * English is the server's first language.
 */
const CHANNELS: ChannelSpec[] = [
    { name: 'welcome', was: 'bienvenida', tier: 0, topic: 'What ZEROxWORK is and how to get in. Nobody from the team will ever DM you first.' },
    { name: 'announcements', was: 'anuncios', tier: 0, topic: 'News. Only admins post here.' },
    // The only place someone who has not linked can write: without it, a person
    // stuck at the door would have nowhere to say so.
    { name: HELP_CHANNEL_NAME, tier: 1, topic: 'Trouble linking your account or getting in? Ask here, in any language.' },
    // A general channel per language. Everyone reads, linked members write.
    // English keeps the channel that used to be the only #general.
    ...WELCOME_LANGS.map((lang): ChannelSpec => ({
        name: generalChannelName(lang),
        ...(lang === 'en' ? { was: 'general' } : {}),
        tier: 4,
        topic: GENERAL_TOPICS[lang],
        lobby: true,
    })),
    { name: 'projects', was: 'proyectos', tier: 2, topic: 'What everyone is working on.' },
    { name: 'feedback', tier: 2, topic: 'Show your work and ask for opinions.' },
    { name: 'tools', was: 'herramientas', tier: 2, topic: 'The community\'s tools.' },
    { name: 'mod-log', tier: 3, topic: 'AutoMod and bot alerts.' },
];

/** Taken from @everyone and handed back to the member role. */
const MEMBER_PRIVILEGES = [
    PermissionFlagsBits.EmbedLinks,
    PermissionFlagsBits.AttachFiles,
    PermissionFlagsBits.UseExternalEmojis,
    PermissionFlagsBits.CreateInstantInvite,
];

/** Patterns, not words: "wallet" or "airdrop" alone are normal talk here. */
const SCAM_PATTERNS = [
    '(?i)free\\s*(discord\\s*)?nitro',
    '(?i)(claim|reclama)\\s+(your|tu)?\\s*(free|gratis)?\\s*(airdrop|nitro|reward|premio)',
    '(?i)(connect|conecta|sincroniza|valida)\\s+(your|tu)?\\s*wallet\\s+(to|para|here|aqui|en)',
    '(?i)(send|manda|envia|comparte|dame)\\b.{0,30}\\b(seed\\s*phrase|frase\\s*semilla|private\\s*key|clave\\s*privada)',
    '(?i)(soporte|support)\\s+(oficial|official|team)\\b.{0,30}\\b(dm|mp|privado|direct)',
];

/**
 * Links from people who have not linked their account. Three shapes, because
 * those are the ones Discord turns into something clickable. A bare
 * "example.com" stays plain text and is left alone.
 */
const LINK_PATTERNS = [
    '(?i)https?://',
    '(?i)\\bwww\\.[a-z0-9-]+\\.[a-z]{2,}',
    '(?i)discord(\\.gg|(app)?\\.com/invite)/[a-z0-9-]+',
];
/** Our own site is always fine to post, linked or not. */
const LINK_ALLOW_LIST = ['https://zeroxwork.com', 'https://zeroxwork.com/*'];
/** Shown to whoever gets blocked. English: it is the server's first language. Discord caps it at 150. */
const LINK_BLOCK_MESSAGE = 'Links are for linked members. Link your account at zeroxwork.com/account to get the ZEROxMEMBER role.';

/**
 * Shown on the invite. One text for everyone, so it is in English, the
 * server's first language. Discord caps it at 120 characters.
 */
const SERVER_DESCRIPTION = 'Build or play. ZEROxWORK: an online community-cowork for code and art. ZEROxPLAY: our games.';

const changes: string[] = [];
const skipped: string[] = [];
const failures: string[] = [];
/** Wanted, but out of the bot's reach: someone with access has to do it. */
const manual: string[] = [];

function plan(line: string) { changes.push(line); console.log(`  → ${line}`); }
function ok(line: string) { skipped.push(line); console.log(`  ✓ ${line}`); }
function fail(line: string) { failures.push(line); console.log(`  ✗ ${line}`); }
function byHand(line: string) { manual.push(line); console.log(`  ✋ ${line}`); }

async function hardenGuild(guild: Guild) {
    console.log('\n[servidor]');

    if (guild.verificationLevel !== GuildVerificationLevel.Medium) {
        plan(`verification level: ${GuildVerificationLevel[guild.verificationLevel]} → Medium`);
        if (APPLY) await guild.setVerificationLevel(GuildVerificationLevel.Medium).catch((e) => fail(`verification level: ${e.message}`));
    } else ok('verification level already Medium');

    if (guild.explicitContentFilter !== GuildExplicitContentFilter.AllMembers) {
        plan('explicit content filter → everyone');
        if (APPLY) await guild.setExplicitContentFilter(GuildExplicitContentFilter.AllMembers).catch((e) => fail(`content filter: ${e.message}`));
    } else ok('content filter already on for everyone');

    // Discord's own raid and safety warnings: staff only, next to the AutoMod alerts
    const modLog = guild.channels.cache.find((c) => c.name === 'mod-log' && c.type === ChannelType.GuildText);
    if (!modLog) {
        fail('safety alerts channel: #mod-log is not visible to the bot');
    } else if (guild.safetyAlertsChannelId !== modLog.id) {
        plan('safety alerts channel → #mod-log');
        if (APPLY) await guild.edit({ safetyAlertsChannel: modLog.id }).catch((e) => fail(`safety alerts channel: ${e.message}`));
    } else ok('safety alerts already go to #mod-log');

    if (guild.description !== SERVER_DESCRIPTION) {
        plan(`description: ${JSON.stringify(guild.description)} → ${JSON.stringify(SERVER_DESCRIPTION)}`);
        if (APPLY) await guild.edit({ description: SERVER_DESCRIPTION }).catch((e) => fail(`description: ${e.message}`));
    } else ok('description already set');
}

async function hardenRoles(guild: Guild) {
    console.log('\n[roles]');
    const everyone = guild.roles.everyone;
    const toDeny = [...MEMBER_PRIVILEGES, PermissionFlagsBits.MentionEveryone].filter((flag) => everyone.permissions.has(flag));

    if (toDeny.length) {
        plan(`@everyone loses ${toDeny.length} permission(s) including mentioning everyone and posting links`);
        if (APPLY) {
            const next = everyone.permissions.remove(toDeny);
            await everyone.setPermissions(next).catch((e) => fail(`@everyone: ${e.message}`));
        }
    } else ok('@everyone already stripped');

    const member = await guild.roles.fetch(memberRoleId!);
    if (!member) return fail(`member role ${memberRoleId} not found`);

    const toGrant = MEMBER_PRIVILEGES.filter((flag) => !member.permissions.has(flag));
    const me = await guild.members.fetchMe();
    if (toGrant.length === 0) {
        ok(`${member.name} already has its privileges`);
    } else if (toGrant.some((flag) => !me.permissions.has(flag))) {
        // Discord refuses to let a bot hand out permissions it does not hold
        fail(`${member.name} is missing ${toGrant.length} permission(s) the bot cannot grant because it does not hold them. `
            + `Tick them by hand: Server Settings → Roles → ${member.name} → Embed Links, Attach Files, Use External Emoji, Create Invite.`);
    } else {
        plan(`${member.name} gets back links, files, external emoji and invites`);
        if (APPLY) await member.setPermissions(member.permissions.add(toGrant)).catch((e) => fail(`${member.name}: ${e.message}`));
    }
}

type Flag = 'ViewChannel' | 'SendMessages' | 'Connect';

/** One permission overwrite as it should end up. `null` means "no opinion", cleared. */
interface Desired {
    id: string;
    who: string;
    set: Partial<Record<Flag, boolean | null>>;
}

function overwriteDiffers(channel: TextChannel | VoiceChannel, desired: Desired): boolean {
    const current = channel.permissionOverwrites.cache.get(desired.id);
    return Object.entries(desired.set).some(([name, value]) => {
        const flag = PermissionFlagsBits[name as Flag];
        const allowed = current?.allow.has(flag) ?? false;
        const denied = current?.deny.has(flag) ?? false;
        if (value === null) return allowed || denied;
        return value ? !allowed : !denied;
    });
}

function describeSet(set: Desired['set']): string {
    return Object.entries(set)
        .map(([name, value]) => `${name} ${value === null ? 'cleared' : value ? 'allowed' : 'denied'}`)
        .join(', ');
}

/**
 * Bring one existing channel to the agreed state, touching only what differs.
 * The order of `desired` matters: whoever must keep access goes before the
 * @everyone deny, or the bot locks itself out halfway through.
 */
async function reconcileChannel(channel: TextChannel | VoiceChannel, label: string, desired: Desired[], slowmode: number) {
    let touched = false;

    for (const item of desired) {
        if (!overwriteDiffers(channel, item)) continue;
        touched = true;
        plan(`${label}: ${item.who}: ${describeSet(item.set)}`);
        if (APPLY) {
            const applied = await channel.permissionOverwrites.edit(item.id, item.set)
                .then(() => true)
                .catch((e) => { fail(`${label} ${item.who}: ${e.message}`); return false; });
            // an allow that failed must never be followed by the deny that relies on it
            if (!applied) {
                fail(`${label}: stopped there, the remaining changes were not attempted`);
                return;
            }
        }
    }

    if ((channel.rateLimitPerUser ?? 0) !== slowmode) {
        touched = true;
        plan(`${label}: slowmode ${channel.rateLimitPerUser ?? 0}s → ${slowmode}s`);
        if (APPLY) await channel.setRateLimitPerUser(slowmode).catch((e) => fail(`${label} slowmode: ${e.message}`));
    }

    if (!touched) ok(`${label} already as agreed`);
}

function toCreateOverwrites(desired: Desired[]) {
    return desired.map((item) => ({
        id: item.id,
        allow: Object.entries(item.set).filter(([, v]) => v === true).map(([k]) => PermissionFlagsBits[k as Flag]),
        deny: Object.entries(item.set).filter(([, v]) => v === false).map(([k]) => PermissionFlagsBits[k as Flag]),
    }));
}

async function hardenChannels(guild: Guild) {
    console.log('\n[canales]');
    const me = await guild.members.fetchMe();
    const existing = await guild.channels.fetch();

    const everyone = { id: guild.id, who: '@everyone' };
    const member = { id: memberRoleId!, who: 'ZEROxMEMBER' };
    const bot = { id: me.id, who: 'the bot' };

    // tier 0: everyone reads, only admins write
    // tier 1: everyone reads and writes, slowed down
    // tier 2: members only
    // tier 3: staff and the bot, which posts the AutoMod alerts there
    // tier 4: everyone reads, members write
    const desiredFor = (tier: number): { desired: Desired[]; slowmode: number } => {
        switch (tier) {
            case 0: return { desired: [{ ...everyone, set: { SendMessages: false } }], slowmode: 0 };
            case 1: return { desired: [], slowmode: 30 };
            case 4: return {
                desired: [
                    { ...member, set: { SendMessages: true } },
                    { ...everyone, set: { SendMessages: false } },
                ],
                slowmode: 0,
            };
            case 2: return {
                desired: [
                    { ...member, set: { ViewChannel: true, SendMessages: true } },
                    { ...everyone, set: { ViewChannel: false } },
                ],
                slowmode: 0,
            };
            default: return {
                desired: [
                    { ...bot, set: { ViewChannel: true, SendMessages: true } },
                    { ...everyone, set: { ViewChannel: false } },
                ],
                slowmode: 0,
            };
        }
    };

    // Text channels only: a voice channel may share the name ("General" next to
    // #general), and matching across types once sent these changes to the wrong one.
    const textByName = new Map<string, TextChannel>();
    for (const channel of existing.values()) {
        if (channel?.type === ChannelType.GuildText) textByName.set(channel.name.toLowerCase(), channel);
    }

    // The language channels sit together, in whatever category the first one is in.
    const firstLobby = CHANNELS.find((spec) => spec.lobby);
    const lobbyParentId = firstLobby
        ? (textByName.get(firstLobby.name) ?? (firstLobby.was ? textByName.get(firstLobby.was) : undefined))?.parentId ?? null
        : null;

    for (const spec of CHANNELS) {
        const { desired, slowmode } = desiredFor(spec.tier);
        // Under its old name it is the same channel: rename it, never create a twin.
        const found = textByName.get(spec.name) ?? (spec.was ? textByName.get(spec.was) : undefined);

        if (!found) {
            plan(`create #${spec.name} (${['escaparate', 'abierto', 'miembros', 'staff', 'leen todos, escriben miembros'][spec.tier]})`);
            if (APPLY) {
                await guild.channels.create({
                    name: spec.name,
                    type: ChannelType.GuildText,
                    topic: spec.topic ?? undefined,
                    parent: spec.lobby ? lobbyParentId : null,
                    rateLimitPerUser: slowmode,
                    permissionOverwrites: toCreateOverwrites(desired),
                }).catch((e) => fail(`#${spec.name}: ${e.message}`));
            }
            continue;
        }

        const rename = found.name !== spec.name;
        const retopic = spec.topic !== null && (found.topic ?? '') !== spec.topic;
        const wording = [
            rename ? `rename to #${spec.name}` : '',
            retopic ? `topic → "${spec.topic}"` : '',
        ].filter(Boolean).join(', ');

        if (!found.permissionsFor(me).has(PermissionFlagsBits.ViewChannel)) {
            // Manage Channels is not enough on a channel the bot cannot see
            if (wording) byHand(`#${found.name}: ${wording}`);
            if (spec.tier === 3) {
                fail(`#${spec.name}: the bot cannot see it. Add ZEROxBOT to that channel with View Channel and Send Messages.`);
            } else {
                ok(`#${found.name} is members only; the bot has no access there and needs none`);
            }
            continue;
        }

        if (wording) {
            // one edit for both: Discord allows two name or topic changes per channel every ten minutes
            plan(`#${found.name}: ${wording}`);
            if (APPLY) {
                await found.edit({ name: spec.name, ...(retopic ? { topic: spec.topic } : {}) })
                    .catch((e) => fail(`#${found.name}: ${e.message}`));
            }
        }

        // If the bot already gets in some other way (its role was added by hand,
        // say), leave that alone instead of stacking a second overwrite on top.
        const botAlreadyIn = found.permissionsFor(me).has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]);
        const needed = desired.filter((item) => !(item.id === bot.id && botAlreadyIn));

        await reconcileChannel(found, `#${spec.name}`, needed, slowmode);
    }

    // Voice sits behind the member role like everything outside the two public tiers.
    for (const channel of existing.values()) {
        if (channel?.type !== ChannelType.GuildVoice) continue;
        await reconcileChannel(channel, `voice "${channel.name}"`, [
            { ...bot, set: { ViewChannel: true, Connect: true } },
            { ...member, set: { ViewChannel: true, Connect: true } },
            { ...everyone, set: { ViewChannel: false, SendMessages: null } },
        ], 0);
    }
}

async function hardenAutoMod(guild: Guild) {
    console.log('\n[automod]');
    let current;
    try {
        current = await guild.autoModerationRules.fetch();
    } catch (error) {
        return fail(`cannot read AutoMod rules (needs Manage Server): ${(error as Error).message}`);
    }

    const names = new Set([...current.values()].map((rule) => rule.name));
    const alertChannel = guild.channels.cache.find((c) => c.name === 'mod-log' && c.type === ChannelType.GuildText);
    const me = await guild.members.fetchMe();
    if (alertChannel && !alertChannel.permissionsFor(me)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])) {
        return fail('AutoMod rules post their alerts in #mod-log, and the bot cannot see or write there yet.');
    }
    const alertAction = alertChannel
        ? [{ type: AutoModerationActionType.SendAlertMessage, metadata: { channel: alertChannel.id } }]
        : [];

    const rules = [
        {
            name: 'ZEROxWORK: menciones masivas',
            eventType: AutoModerationRuleEventType.MessageSend,
            triggerType: AutoModerationRuleTriggerType.MentionSpam,
            triggerMetadata: { mentionTotalLimit: 5 },
            actions: [{ type: AutoModerationActionType.BlockMessage }, ...alertAction],
        },
        {
            name: 'ZEROxWORK: spam',
            eventType: AutoModerationRuleEventType.MessageSend,
            triggerType: AutoModerationRuleTriggerType.Spam,
            triggerMetadata: {},
            actions: [{ type: AutoModerationActionType.BlockMessage }, ...alertAction],
        },
        {
            name: 'ZEROxWORK: patrones de estafa',
            eventType: AutoModerationRuleEventType.MessageSend,
            triggerType: AutoModerationRuleTriggerType.Keyword,
            triggerMetadata: { regexPatterns: SCAM_PATTERNS },
            actions: [{ type: AutoModerationActionType.BlockMessage }, ...alertAction],
        },
        {
            // Denying Embed Links only hides the preview: the URL still gets posted.
            // This is what actually keeps links to members who linked their account.
            name: 'ZEROxWORK: enlaces sin vincular',
            eventType: AutoModerationRuleEventType.MessageSend,
            triggerType: AutoModerationRuleTriggerType.Keyword,
            triggerMetadata: { regexPatterns: LINK_PATTERNS, allowList: LINK_ALLOW_LIST },
            exemptRoles: [memberRoleId!],
            actions: [
                { type: AutoModerationActionType.BlockMessage, metadata: { customMessage: LINK_BLOCK_MESSAGE } },
                ...alertAction,
            ],
        },
    ];

    for (const rule of rules) {
        if (names.has(rule.name)) { ok(`${rule.name} already exists`); continue; }
        plan(`create rule "${rule.name}"`);
        if (APPLY) {
            await guild.autoModerationRules.create({ ...rule, enabled: true } as never)
                .catch((e) => fail(`${rule.name}: ${e.message}`));
        }
    }
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('clientReady', async () => {
    try {
        const guild = await (await client.guilds.fetch(guildId!)).fetch();
        console.log(`\n${APPLY ? 'APPLYING TO' : 'DRY RUN against'} ${guild.name}`);

        const me = await guild.members.fetchMe();
        const missing = (['ManageGuild', 'ManageChannels', 'ManageRoles'] as const)
            .filter((p) => !me.permissions.has(PermissionFlagsBits[p]));
        if (missing.length) {
            console.log(`\n⚠ The bot is missing: ${missing.join(', ')}. Grant them for this run.`);
            if (APPLY) { console.log('Refusing to apply a half-configuration.\n'); return; }
        }

        await hardenGuild(guild);
        await hardenRoles(guild);
        await hardenChannels(guild);
        await hardenAutoMod(guild);

        console.log(`\n${APPLY ? 'applied' : 'would change'}: ${changes.length} | already fine: ${skipped.length} | failed: ${failures.length} | by hand: ${manual.length}`);
        if (manual.length) console.log(`To do by hand, the bot cannot see these channels:\n${manual.map((line) => `  - ${line}`).join('\n')}`);
        if (!APPLY) console.log('Nothing was changed. Re-run with --apply when the plan looks right.\n');
        else console.log('Remember to take Manage Server and Manage Channels back off the bot.\n');
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
