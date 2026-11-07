import { describe, it, expect } from 'vitest';
import {
    resolvePublicName,
    handleCandidate,
    handleCandidates,
    autoHandle,
    isAutoHandle,
    stripNameSuffix,
} from '../src/config/public-name.js';

describe('resolvePublicName', () => {
    it('prefers the name the member typed over everything else', () => {
        expect(resolvePublicName({
            id: 7,
            displayName: 'Pablo Estornut',
            discordLink: { globalName: 'voxters', username: 'voxters' },
            defaultName: { name: 'pablo.dcl.eth' },
        })).toBe('Pablo Estornut');
    });

    it('falls back to the Discord global name, then the username', () => {
        expect(resolvePublicName({
            id: 7,
            discordLink: { globalName: 'Voxters', username: 'voxters_1234' },
        })).toBe('Voxters');

        expect(resolvePublicName({
            id: 7,
            discordLink: { globalName: null, username: 'voxters_1234' },
        })).toBe('voxters_1234');
    });

    it('falls back to the on-chain name, kept whole so the avatar still resolves', () => {
        expect(resolvePublicName({ id: 7, defaultName: { name: 'pablo.dcl.eth' } })).toBe('pablo.dcl.eth');
    });

    it('falls back to the handle, and to the automatic one when there is none', () => {
        expect(resolvePublicName({ id: 7, handle: 'pablo' })).toBe('pablo');
        expect(resolvePublicName({ id: 7 })).toBe('member-7');
    });

    it('never returns an empty name because a source was blank or whitespace', () => {
        expect(resolvePublicName({
            id: 7,
            displayName: '   ',
            discordLink: { globalName: '', username: '  ' },
            defaultName: { name: '' },
        })).toBe('member-7');
    });

    it('is never the email address, because the email is not one of its inputs', () => {
        const name = resolvePublicName({ id: 7, displayName: null } as any);
        expect(name).toBe('member-7');
        expect(name).not.toContain('@');
    });
});

describe('automatic handles', () => {
    it('builds one from the account id', () => {
        expect(autoHandle(12)).toBe('member-12');
    });

    it('recognises only the automatic shape as replaceable', () => {
        expect(isAutoHandle('member-12')).toBe(true);
        expect(isAutoHandle('pablo')).toBe(false);
        expect(isAutoHandle('member-pablo')).toBe(false);
        expect(isAutoHandle('members-12')).toBe(false);
        expect(isAutoHandle(null)).toBe(false);
    });
});

describe('handleCandidate', () => {
    it('strips the name suffix and lowercases', () => {
        expect(handleCandidate('Pablo.dcl.eth')).toBe('pablo');
        expect(handleCandidate('jgonzalezferrer.base.eth')).toBe('jgonzalezferrer');
    });

    it('hyphenates spaces and drops accents, so the URL stays ascii', () => {
        expect(handleCandidate('Pablo Estornut')).toBe('pablo-estornut');
        expect(handleCandidate('Jesús Núñez')).toBe('jesus-nunez');
    });

    it('refuses a reserved handle instead of handing over a route', () => {
        expect(handleCandidate('admin')).toBeNull();
        expect(handleCandidate('ZEROxWORK.dcl.eth')).toBeNull();
        expect(handleCandidate('Settings')).toBeNull();
    });

    it('refuses anything too short to be a handle', () => {
        expect(handleCandidate('ab')).toBeNull();
        expect(handleCandidate('!!')).toBeNull();
        expect(handleCandidate('')).toBeNull();
        expect(handleCandidate(null)).toBeNull();
    });

    it('never ends a truncated handle on a hyphen', () => {
        const handle = handleCandidate('a'.repeat(29) + ' tail');
        expect(handle).not.toMatch(/-$/);
        expect((handle as string).length).toBeLessThanOrEqual(30);
    });
});

describe('handleCandidates', () => {
    it('offers Discord first, then the on-chain name, then the automatic one', () => {
        expect(handleCandidates({
            id: 7,
            discordLink: { globalName: 'Voxters', username: 'voxters_1234' },
            defaultName: { name: 'pablo.dcl.eth' },
        })).toEqual(['voxters', 'pablo', 'member-7']);
    });

    it('always ends on the automatic handle, which cannot be reserved or taken', () => {
        expect(handleCandidates({ id: 7 })).toEqual(['member-7']);
        expect(handleCandidates({ id: 7, defaultName: { name: 'admin' } })).toEqual(['member-7']);
    });

    it('does not offer the same handle twice', () => {
        expect(handleCandidates({
            id: 7,
            discordLink: { globalName: 'pablo', username: 'pablo' },
            defaultName: { name: 'pablo.dcl.eth' },
        })).toEqual(['pablo', 'member-7']);
    });
});

describe('stripNameSuffix', () => {
    it('leaves a plain name alone', () => {
        expect(stripNameSuffix('Pablo')).toBe('Pablo');
        expect(stripNameSuffix('my.studio')).toBe('my.studio');
    });
});
