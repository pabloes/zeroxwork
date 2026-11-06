import { describe, it, expect } from 'vitest';
import {
    InvalidSocialError,
    SOCIAL_NETWORKS,
    normalizeSocial,
    socialUrl,
} from '../src/constants/social-networks.js';

describe('catalogue', () => {
    it('has unique keys, since the key is what gets stored', () => {
        const keys = SOCIAL_NETWORKS.map((n) => n.key);
        expect(new Set(keys).size).toBe(keys.length);
    });

    it('marks exactly the four networks shown without opening the picker', () => {
        expect(SOCIAL_NETWORKS.filter((n) => n.featured).map((n) => n.key))
            .toEqual(['x', 'instagram', 'youtube', 'reddit']);
    });

    it('gives every url-type network a passthrough template', () => {
        for (const network of SOCIAL_NETWORKS.filter((n) => n.type === 'url')) {
            expect(network.urlTemplate).toBe('{handle}');
        }
    });
});

describe('normalizeSocial', () => {
    it('keeps a plain handle', () => {
        expect(normalizeSocial('x', 'pablo')).toEqual({ network: 'x', handle: 'pablo' });
    });

    it('strips @ and u/ prefixes', () => {
        expect(normalizeSocial('x', '@pablo')?.handle).toBe('pablo');
        expect(normalizeSocial('reddit', 'u/pablo')?.handle).toBe('pablo');
        expect(normalizeSocial('linkedin', 'in/pablo')?.handle).toBe('pablo');
    });

    it('accepts a pasted profile link and keeps the handle', () => {
        expect(normalizeSocial('x', 'https://x.com/pablo')?.handle).toBe('pablo');
        expect(normalizeSocial('github', 'https://github.com/pabloes')?.handle).toBe('pabloes');
    });

    it('treats blank as "not provided" rather than an error', () => {
        expect(normalizeSocial('x', '')).toBeNull();
        expect(normalizeSocial('x', '   ')).toBeNull();
    });

    it('rejects an unknown network', () => {
        expect(() => normalizeSocial('myspace', 'pablo')).toThrow(InvalidSocialError);
    });

    it('rejects handles with unusable characters', () => {
        expect(() => normalizeSocial('x', 'con espacios')).toThrow(InvalidSocialError);
        expect(() => normalizeSocial('x', 'a<script>')).toThrow(InvalidSocialError);
        expect(() => normalizeSocial('x', 'https://x.com/')).toThrow(InvalidSocialError);
    });

    // These links end up in an href, so anything but http(s) must not get through.
    it('rejects non-http schemes on url networks', () => {
        expect(() => normalizeSocial('website', 'javascript:alert(1)')).toThrow(InvalidSocialError);
        expect(() => normalizeSocial('website', 'data:text/html,<script>')).toThrow(InvalidSocialError);
        expect(() => normalizeSocial('website', 'not a url')).toThrow(InvalidSocialError);
    });

    it('accepts http(s) addresses on url networks', () => {
        expect(normalizeSocial('website', 'https://pablo.dev')?.handle).toBe('https://pablo.dev/');
        expect(normalizeSocial('youtube', 'https://youtube.com/@canal')?.handle)
            .toBe('https://youtube.com/@canal');
    });
});

describe('socialUrl', () => {
    it('builds the profile link from the template', () => {
        expect(socialUrl('x', 'pablo')).toBe('https://x.com/pablo');
        expect(socialUrl('reddit', 'pablo')).toBe('https://reddit.com/user/pablo');
        expect(socialUrl('itch', 'pablo')).toBe('https://pablo.itch.io');
    });

    it('returns null for networks without a public profile page', () => {
        expect(socialUrl('discord', 'pablo')).toBeNull();
    });

    it('returns null for an unknown network', () => {
        expect(socialUrl('myspace', 'pablo')).toBeNull();
    });
});
