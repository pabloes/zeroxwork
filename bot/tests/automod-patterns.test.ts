import { describe, it, expect } from 'vitest';
import { IMPERSONATION_PATTERNS } from '../src/automod-patterns.js';

/** AutoMod runs Rust regex; these patterns stay within what JavaScript reads the same way. */
const matchers = IMPERSONATION_PATTERNS.map((pattern) => {
    expect(pattern.startsWith('(?i)')).toBe(true);
    return new RegExp(pattern.slice(4), 'i');
});
const blocked = (name: string) => matchers.some((matcher) => matcher.test(name));

describe('names that pass themselves off as the team', () => {
    it.each([
        'ZEROxWORK Support',
        'ZEROxWORK | Support',
        'zeroxwork support team',
        'ZEROxWORK.com Admin',
        'ZeroXWork Moderator',
        'ZEROxWORK Mod',
        'ZEROxWORK Mods',
        'ZEROxPLAY Team',
        'ZEROxWORK Official',
        'ZEROxWORK Help Desk',
        'Support ZEROxWORK',
        'Admin - ZEROxWORK',
        'Official ZEROxPLAY',
        'ZER0xW0RK Support',
        'ZERO x WORK Staff',
        'Zero.x.Work Administrator',
        '🛠 ZEROxWORK Support 🛠',
    ])('blocks %s', (name) => {
        expect(blocked(name)).toBe(true);
    });

    it.each([
        'ZEROxWORK',
        'ZEROxWORK fan',
        'I love ZEROxPLAY',
        'pabloest',
        'Support',
        'Mod',
        'Admin',
        'The Support Team',
        'modern art',
        'zerox models',
        'ZEROxWORK modeler',
        'ZEROxWORK teammate',
        'Golfcraft Team',
        'xwork support',
        'Zero Support',
    ])('leaves %s alone', (name) => {
        expect(blocked(name)).toBe(false);
    });

    it('fits what AutoMod accepts: at most ten patterns of 260 characters', () => {
        expect(IMPERSONATION_PATTERNS.length).toBeLessThanOrEqual(10);
        for (const pattern of IMPERSONATION_PATTERNS) expect(pattern.length).toBeLessThanOrEqual(260);
    });
});
