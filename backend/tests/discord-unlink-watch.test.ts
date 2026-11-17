import { describe, it, expect } from 'vitest';
import { discordIdsLosingTheirLink, type UnlinkWatchDb } from '../src/services/discord-unlink-watch.js';

/** Two users with a link each, and one without. */
const links = [
    { id: 1, userId: 10, discordId: 'discord-ana' },
    { id: 2, userId: 20, discordId: 'discord-luis' },
];
const asked: unknown[] = [];

const matches = (row: Record<string, unknown>, where: any) => Object.entries(where ?? {}).every(([key, value]) => {
    if (value && typeof value === 'object' && 'in' in (value as object)) return ((value as any).in as unknown[]).includes(row[key]);
    return row[key] === value;
});

const db: UnlinkWatchDb = {
    linksWhere: async (where) => { asked.push(where); return links.filter((link) => matches(link, where)); },
    linksOfUsersWhere: async (where) => { asked.push(where); return links.filter((link) => matches({ id: link.userId }, where)); },
};

const going = (model: string | undefined, action: string, args?: unknown) => discordIdsLosingTheirLink({ model, action, args }, db);

describe('links that are about to go', () => {
    it('one deleted link', async () => {
        expect(await going('DiscordLink', 'delete', { where: { id: 1 } })).toEqual(['discord-ana']);
    });

    it('the unlink button, which deletes by user', async () => {
        expect(await going('DiscordLink', 'deleteMany', { where: { userId: 20 } })).toEqual(['discord-luis']);
    });

    it('a deleted user: the database takes the link with it', async () => {
        expect(await going('User', 'delete', { where: { id: 10 } })).toEqual(['discord-ana']);
    });

    it('several users deleted at once, as the merge script does', async () => {
        expect(await going('User', 'deleteMany', { where: { id: { in: [10, 20, 30] } } })).toEqual(['discord-ana', 'discord-luis']);
    });

    it('a user without a link: nobody to tell about', async () => {
        expect(await going('User', 'delete', { where: { id: 30 } })).toEqual([]);
    });

    it('the same user linking another Discord account: the old one is left without', async () => {
        const relink = { where: { userId: 10 }, create: { userId: 10, discordId: 'discord-new' }, update: { discordId: 'discord-new' } };
        expect(await going('DiscordLink', 'upsert', relink)).toEqual(['discord-ana']);
        expect(await going('DiscordLink', 'update', { where: { id: 1 }, data: { discordId: { set: 'discord-new' } } })).toEqual(['discord-ana']);
    });
});

describe('what is not an unlink', () => {
    it('linking for the first time', async () => {
        const first = { where: { userId: 30 }, create: { userId: 30, discordId: 'discord-new' }, update: { discordId: 'discord-new' } };
        expect(await going('DiscordLink', 'upsert', first)).toEqual([]);
    });

    it('linking the same Discord account again', async () => {
        const same = { where: { userId: 10 }, create: { userId: 10, discordId: 'discord-ana' }, update: { discordId: 'discord-ana', username: 'ana' } };
        expect(await going('DiscordLink', 'upsert', same)).toEqual([]);
    });

    it('an update that does not touch the Discord account, such as the bot marking it synced', async () => {
        expect(await going('DiscordLink', 'update', { where: { id: 1 }, data: { lastSyncedAt: new Date() } })).toEqual([]);
        expect(await going('User', 'update', { where: { id: 10 }, data: { displayName: 'Ana' } })).toEqual([]);
    });

    it('reads, and every other table, without asking the database anything', async () => {
        asked.length = 0;
        expect(await going('DiscordLink', 'findMany', { where: {} })).toEqual([]);
        expect(await going('Article', 'delete', { where: { id: 1 } })).toEqual([]);
        expect(await going(undefined, 'queryRaw')).toEqual([]);
        expect(asked).toEqual([]);
    });
});

describe('when the lookup itself fails', () => {
    it('answers nobody instead of stopping the delete it is watching', async () => {
        const broken: UnlinkWatchDb = {
            linksWhere: async () => { throw new Error('database gone'); },
            linksOfUsersWhere: async () => { throw new Error('database gone'); },
        };
        expect(await discordIdsLosingTheirLink({ model: 'DiscordLink', action: 'delete', args: { where: { id: 1 } } }, broken)).toEqual([]);
        expect(await discordIdsLosingTheirLink({ model: 'User', action: 'delete', args: { where: { id: 10 } } }, broken)).toEqual([]);
    });
});
