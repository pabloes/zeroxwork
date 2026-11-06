import { describe, it, expect } from 'vitest';
import { validateDisplayName, avatarUrlHash, DISPLAY_NAME_MAX } from '../src/config/profile.js';

const SHA = 'a'.repeat(64);

describe('display name validation', () => {
    it('clears the name on null, undefined or blank input', () => {
        for (const input of [null, undefined, '', '   ']) {
            expect(validateDisplayName(input)).toEqual({ ok: true, value: null });
        }
    });

    it('accepts and normalises a normal name', () => {
        expect(validateDisplayName('  Pablo   Estornut ')).toEqual({ ok: true, value: 'Pablo Estornut' });
        expect(validateDisplayName('张伟')).toEqual({ ok: true, value: '张伟' });
    });

    it('rejects names that are too short or too long', () => {
        expect(validateDisplayName('a')).toEqual({ ok: false, code: 'DISPLAY_NAME_LENGTH' });
        expect(validateDisplayName('x'.repeat(DISPLAY_NAME_MAX + 1))).toEqual({ ok: false, code: 'DISPLAY_NAME_LENGTH' });
    });

    it('rejects control characters and angle brackets', () => {
        expect(validateDisplayName('Pablo<script>')).toEqual({ ok: false, code: 'DISPLAY_NAME_INVALID' });
        expect(validateDisplayName('Pablo\u0000')).toEqual({ ok: false, code: 'DISPLAY_NAME_INVALID' });
    });

    it('never lets the public name be an email address', () => {
        expect(validateDisplayName('pablo@example.com')).toEqual({ ok: false, code: 'DISPLAY_NAME_EMAIL' });
        expect(validateDisplayName('Pablo <pablo@example.com>')).toEqual({ ok: false, code: 'DISPLAY_NAME_INVALID' });
    });
});

describe('avatar URL validation', () => {
    it('accepts a path served by our own image service', () => {
        expect(avatarUrlHash(`/api/images/user-uploaded-images/${SHA}.png`)).toBe(SHA);
        expect(avatarUrlHash(`  /api/images/user-uploaded-images/${SHA}.webp  `)).toBe(SHA);
    });

    it('rejects third-party avatar hosts', () => {
        expect(avatarUrlHash('https://www.gravatar.com/avatar/abc')).toBeNull();
        expect(avatarUrlHash('https://evil.com/api/images/user-uploaded-images/' + SHA + '.png')).toBeNull();
        expect(avatarUrlHash('//evil.com/pic.png')).toBeNull();
    });

    it('rejects paths that are not a plain sha256 file name', () => {
        expect(avatarUrlHash('/api/images/user-uploaded-images/../../secret.png')).toBeNull();
        expect(avatarUrlHash(`/api/images/user-uploaded-images/${SHA}`)).toBeNull();
        expect(avatarUrlHash('/api/images/user-uploaded-images/not-a-hash.png')).toBeNull();
        expect(avatarUrlHash('/api/images/banned-images/' + SHA + '.png')).toBeNull();
    });

    it('rejects empty input', () => {
        expect(avatarUrlHash(null)).toBeNull();
        expect(avatarUrlHash(undefined)).toBeNull();
        expect(avatarUrlHash('')).toBeNull();
    });
});
