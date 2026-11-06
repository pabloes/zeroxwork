import { describe, it, expect } from 'vitest';
import { BASE_ROLE_KEY, desiredRoleIds, isNoop, roleDiff } from '../src/roles.js';

const ROLE_IDS = new Map([
    [BASE_ROLE_KEY, '100'],
    ['crash_city_participant', '200'],
    ['crash_city_creator', '300'],
]);
const MANAGED = new Set(ROLE_IDS.values());

const MODERATOR = '999'; // a role the bot does not manage

describe('desiredRoleIds', () => {
    it('gives the base role to anyone linked', () => {
        expect(desiredRoleIds({ grantedRoleKeys: [] }, ROLE_IDS)).toEqual(new Set(['100']));
    });

    it('adds the roles granted by hand', () => {
        expect(desiredRoleIds({ grantedRoleKeys: ['crash_city_creator'] }, ROLE_IDS))
            .toEqual(new Set(['100', '300']));
    });

    it('gives nothing to someone with no link, which is how unlinking revokes', () => {
        expect(desiredRoleIds(null, ROLE_IDS).size).toBe(0);
    });

    it('skips a granted key whose role id is not configured instead of guessing', () => {
        expect(desiredRoleIds({ grantedRoleKeys: ['season_two_winner'] }, ROLE_IDS))
            .toEqual(new Set(['100']));
    });

    it('works when the base role itself is not configured yet', () => {
        expect(desiredRoleIds({ grantedRoleKeys: ['crash_city_creator'] }, new Map([['crash_city_creator', '300']])))
            .toEqual(new Set(['300']));
    });
});

describe('roleDiff', () => {
    it('adds what is missing', () => {
        expect(roleDiff([], new Set(['100']), MANAGED)).toEqual({ add: ['100'], remove: [] });
    });

    it('removes a managed role that is no longer deserved', () => {
        expect(roleDiff(['100'], new Set(), MANAGED)).toEqual({ add: [], remove: ['100'] });
    });

    it('never removes a role the bot does not manage', () => {
        const diff = roleDiff([MODERATOR, '100'], new Set(), MANAGED);
        expect(diff.remove).toEqual(['100']);
        expect(diff.remove).not.toContain(MODERATOR);
    });

    it('never adds a role outside the managed set, even if something asks for it', () => {
        expect(roleDiff([], new Set([MODERATOR]), MANAGED)).toEqual({ add: [], remove: [] });
    });

    it('leaves an already correct member untouched', () => {
        const diff = roleDiff([MODERATOR, '100', '300'], new Set(['100', '300']), MANAGED);
        expect(isNoop(diff)).toBe(true);
    });

    it('adds and removes in the same pass when a grant is swapped', () => {
        const diff = roleDiff(['100', '200'], new Set(['100', '300']), MANAGED);
        expect(diff.add).toEqual(['300']);
        expect(diff.remove).toEqual(['200']);
    });

    it('manages nothing when no role id is configured, so a misconfigured bot is harmless', () => {
        const diff = roleDiff(['100', MODERATOR], new Set(), new Set());
        expect(isNoop(diff)).toBe(true);
    });
});
