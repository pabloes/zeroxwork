/**
 * What the bot does to one member, with Discord and the database stood in for.
 *
 * The case this file exists for: the owner gives the member role by hand to
 * somebody who has not linked. The periodic pass used to take it away again.
 */
import { describe, it, expect } from 'vitest';
import { syncMember } from '../src/sync.js';

const MEMBER = 'role-member';
const CREATOR = 'role-creator';
const MODERATOR = 'role-moderator'; // not ours: the bot must never touch it

const config: any = { roleIds: new Map([['zeroxwork', MEMBER], ['crash_city_creator', CREATOR]]) };
const managed = new Set([MEMBER, CREATOR]);

function fakeMember(id: string, roles: string[]) {
    const held = new Set(roles);
    return {
        id,
        held,
        roles: {
            cache: { keys: () => held.keys() },
            add: async (ids: string[]) => { ids.forEach((role) => held.add(role)); },
            remove: async (ids: string[]) => { ids.forEach((role) => held.delete(role)); },
        },
    } as any;
}

/** links: discordId -> the role keys granted by hand in the admin panel */
function fakePrisma(links: Record<string, string[]>) {
    const touched: string[] = [];
    return {
        touched,
        discordLink: {
            findUnique: async ({ where }: any) => (where.discordId in links
                ? { id: 1, discordId: where.discordId, user: { discordRoles: links[where.discordId].map((roleKey) => ({ roleKey })) } }
                : null),
            update: async () => { touched.push('synced'); return {}; },
        },
    } as any;
}

describe('a role given by hand', () => {
    it('stays when the bot comes round on its own', async () => {
        const member = fakeMember('jeyjey', [MEMBER, MODERATOR]);
        const outcome = await syncMember(member, fakePrisma({}), config, managed);
        expect([...member.held].sort()).toEqual([MEMBER, MODERATOR].sort());
        expect(outcome.applied).toEqual({ add: [], remove: [] });
    });

    it('stays for a linked member holding a role no grant covers', async () => {
        const member = fakeMember('ana', [MEMBER, CREATOR]);
        await syncMember(member, fakePrisma({ ana: [] }), config, managed);
        expect(member.held.has(CREATOR)).toBe(true);
    });
});

describe('what the website asks for', () => {
    it('is given: a linked member without the role gets it, on any pass', async () => {
        const member = fakeMember('ana', []);
        const outcome = await syncMember(member, fakePrisma({ ana: [] }), config, managed);
        expect([...member.held]).toEqual([MEMBER]);
        expect(outcome.applied.add).toEqual([MEMBER]);
    });

    it('is taken away when the website queued an unlink for that account', async () => {
        const member = fakeMember('ana', [MEMBER, MODERATOR]);
        const outcome = await syncMember(member, fakePrisma({}), config, managed, true);
        expect([...member.held]).toEqual([MODERATOR]);
        expect(outcome.applied.remove).toEqual([MEMBER]);
    });

    it('takes away only the role a deleted grant covered, when a grant changes', async () => {
        const member = fakeMember('ana', [MEMBER, CREATOR]);
        await syncMember(member, fakePrisma({ ana: [] }), config, managed, true);
        expect([...member.held]).toEqual([MEMBER]);
    });

    it('never touches a role the bot does not manage, even when allowed to remove', async () => {
        const member = fakeMember('ana', [MODERATOR]);
        await syncMember(member, fakePrisma({}), config, managed, true);
        expect(member.held.has(MODERATOR)).toBe(true);
    });

    it('does not take the role from somebody whose unlink was queued by mistake: the link is still there', async () => {
        const member = fakeMember('ana', [MEMBER]);
        await syncMember(member, fakePrisma({ ana: [] }), config, managed, true);
        expect(member.held.has(MEMBER)).toBe(true);
    });
});
