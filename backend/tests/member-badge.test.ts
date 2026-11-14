/**
 * The badge has to survive being read by a renderer we do not control, on a
 * page we do not own. These are the things that would break it there and that
 * nothing else would catch: a reference pointing back at us, a name that is
 * also markup, and a long handle running off the card into the mark.
 */
import { describe, it, expect } from 'vitest';
import { buildBadge, badgeWidth, textWidth } from '../src/services/member-badge.js';
import { drawnAvatar } from '../src/services/badge-avatar.js';

const MARK = 'data:image/png;base64,AAAA';
const photo = { kind: 'photo' as const, dataUri: 'data:image/jpeg;base64,BBBB' };

const badge = (label: string, avatar = photo) => buildBadge({ label, avatar }, MARK);

describe('the badge is one self-contained file', () => {
    it('never points at anything outside itself', () => {
        const svg = badge('carlosmu');
        // Everything an <img> would refuse to load on somebody else's page.
        // The only http:// allowed is the namespace in the opening tag.
        expect(svg).not.toMatch(/href="(?!data:)/);
        expect(svg).not.toMatch(/url\((?!#)/);
        expect(svg.slice(svg.indexOf('><'))).not.toContain('http');
        expect(svg).not.toContain('<style');
    });

    it('declares the SVG namespace and its own size', () => {
        const svg = badge('carlosmu');
        expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
        expect(svg).toMatch(/width="\d+" height="120" viewBox="0 0 \d+ 120"/);
    });

    it('carries the mark when there is one, and leaves it out when there is not', () => {
        expect(badge('carlosmu')).toContain(MARK);
        const without = buildBadge({ label: 'carlosmu', avatar: photo }, null);
        expect(without).not.toContain(MARK);
        expect(without).toContain(photo.dataUri); // the rest is still a badge
        expect(without).toContain('carlosmu');
    });
});

describe('the words fit the card', () => {
    it('grows the card for a longer handle', () => {
        expect(badgeWidth('una-handle-larguisima-de-30')).toBeGreaterThan(badgeWidth('ana'));
    });

    it('never gets narrower than the line it always carries, nor past the cap', () => {
        // ZEROxWORK.com sets the floor: a short handle cannot pull the card in
        // under it, so every short handle gets the same card.
        expect(badgeWidth('ana')).toBe(badgeWidth('bo'));
        expect(badgeWidth('ana')).toBeGreaterThanOrEqual(400);
        expect(badgeWidth('x'.repeat(200))).toBe(900);
    });

    it('pins every line to a measured length, so another font cannot overflow', () => {
        const svg = badge('carlosmu');
        const pinned = svg.match(/textLength="[\d.]+" lengthAdjust="spacingAndGlyphs"/g) ?? [];
        expect(pinned).toHaveLength(2);
    });

    it('keeps the label clear of the mark even at the cap', () => {
        const label = 'z'.repeat(200);
        const svg = buildBadge({ label, avatar: photo }, MARK);
        const width = Number(/width="(\d+)"/.exec(svg)![1]);
        const length = Number(/textLength="([\d.]+)"/.exec(svg)![1]);
        // 134 is where the text starts; the mark and its margins take the rest.
        expect(134 + length).toBeLessThanOrEqual(width - 94 - 18 - 6 + 0.5);
    });

    it('measures a wider string as wider', () => {
        expect(textWidth('mmmm', 20)).toBeGreaterThan(textWidth('llll', 20));
    });
});

describe('what goes in the file is escaped', () => {
    it('escapes the label', () => {
        const svg = badge('<script>&"');
        expect(svg).not.toContain('<script>');
        expect(svg).toContain('&lt;script&gt;&amp;&quot;');
    });

    it('escapes the initials of a generated avatar', () => {
        const svg = buildBadge({ label: 'someone', avatar: drawnAvatar({ id: 3, name: '<x> & "y"' }) }, MARK);
        expect(svg).not.toContain('<x>');
    });
});

describe('the generated avatar stands in for a missing picture', () => {
    it('draws shapes instead of an image', () => {
        const svg = buildBadge({ label: 'someone', avatar: drawnAvatar({ id: 7, name: 'Pablo Estornut' }) }, MARK);
        expect(svg).toContain('PE');
        expect(svg).not.toContain('data:image/jpeg');
    });

    it('gives the same account the same avatar every time', () => {
        const once = drawnAvatar({ id: 11, name: null });
        const twice = drawnAvatar({ id: 11, name: null });
        expect(once).toEqual(twice);
    });
});

describe('where the avatar may come from', () => {
    it('reads our own uploads and nothing else', async () => {
        const { badgeAvatar } = await import('../src/services/badge-avatar.js');

        // A whole address, even one wearing our own path, is not read: the
        // profile only ever stores the path, and a badge must not turn into
        // our server fetching an address somebody else chose.
        const foreign = await badgeAvatar({ id: 1, avatarUrl: 'https://example.com/avatar.png' });
        expect(foreign.kind).toBe('drawn');

        // Our own path, pointing at a file that is not there: the drawn avatar
        // takes over rather than leaving a hole.
        const gone = await badgeAvatar({ id: 1, avatarUrl: '/api/images/user-uploaded-images/nope.png' });
        expect(gone.kind).toBe('drawn');

        // And nothing that is not a plain file name gets near the disk.
        const traversal = await badgeAvatar({ id: 1, avatarUrl: '/api/images/user-uploaded-images/..%2F..%2F.env' });
        expect(traversal.kind).toBe('drawn');
    });
});
