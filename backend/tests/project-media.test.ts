import { describe, it, expect } from 'vitest';
import {
    validateCover,
    normaliseScreenshots,
    validateVideoUrl,
    SCREENSHOTS_MIN,
    SCREENSHOTS_MAX,
} from '../src/config/project-media.js';

const shot = (n: number) => `/api/images/user-uploaded-images/${String(n).repeat(64)}.png`;
const shots = (count: number) => Array.from({ length: count }, (_, i) => shot(i % 10));

describe('validateCover', () => {
    it('requires one for a project', () => {
        expect(validateCover('', true)).toEqual({ ok: false, code: 'COVER_REQUIRED' });
        expect(validateCover(null, true)).toEqual({ ok: false, code: 'COVER_REQUIRED' });
        expect(validateCover('   ', true)).toEqual({ ok: false, code: 'COVER_REQUIRED' });
    });

    it('leaves a post without one alone', () => {
        expect(validateCover('', false)).toEqual({ ok: true, value: null });
        expect(validateCover(undefined, false)).toEqual({ ok: true, value: null });
    });

    it('accepts an uploaded path and an https URL', () => {
        expect(validateCover(shot(1), true)).toEqual({ ok: true, value: shot(1) });
        expect(validateCover('https://cdn.example.com/a.png', true)).toEqual({ ok: true, value: 'https://cdn.example.com/a.png' });
    });

    it('refuses a cover that would put a script in an src attribute', () => {
        expect(validateCover('javascript:alert(1)', true)).toEqual({ ok: false, code: 'COVER_REQUIRED' });
        expect(validateCover('data:image/svg+xml;base64,AAA', true)).toEqual({ ok: false, code: 'COVER_REQUIRED' });
        expect(validateCover('http://cdn.example.com/a.png', true)).toEqual({ ok: false, code: 'COVER_REQUIRED' });
        expect(validateCover('//evil.example.com/a.png', true)).toEqual({ ok: false, code: 'COVER_REQUIRED' });
    });
});

describe('normaliseScreenshots', () => {
    it(`asks a project for at least ${SCREENSHOTS_MIN}`, () => {
        expect(normaliseScreenshots(shots(2), true)).toEqual({ ok: false, code: 'SCREENSHOTS_FEW' });
        expect(normaliseScreenshots([], true)).toEqual({ ok: false, code: 'SCREENSHOTS_FEW' });
        expect(normaliseScreenshots(undefined, true)).toEqual({ ok: true, value: [] });
    });

    it(`takes at most ${SCREENSHOTS_MAX}`, () => {
        expect(normaliseScreenshots(shots(SCREENSHOTS_MAX), true).ok).toBe(true);
        expect(normaliseScreenshots(shots(SCREENSHOTS_MAX + 1), true)).toEqual({ ok: false, code: 'SCREENSHOTS_MANY' });
    });

    it('asks nothing of a post', () => {
        expect(normaliseScreenshots([], false)).toEqual({ ok: true, value: [] });
        expect(normaliseScreenshots(shots(1), false)).toEqual({ ok: true, value: [shot(0)] });
    });

    it('keeps the order the author arranged and drops blanks', () => {
        const list = [shot(1), '  ', shot(2), '', shot(3)];
        expect(normaliseScreenshots(list, true)).toEqual({ ok: true, value: [shot(1), shot(2), shot(3)] });
    });

    it('drops a repeated screenshot instead of showing it twice', () => {
        const list = [shot(1), shot(2), shot(1), shot(3)];
        expect(normaliseScreenshots(list, true)).toEqual({ ok: true, value: [shot(1), shot(2), shot(3)] });
    });

    it('refuses anything that is not an image reference', () => {
        expect(normaliseScreenshots('not a list', true)).toEqual({ ok: false, code: 'SCREENSHOT_INVALID' });
        expect(normaliseScreenshots([shot(1), 42, shot(2)], true)).toEqual({ ok: false, code: 'SCREENSHOT_INVALID' });
        expect(normaliseScreenshots([shot(1), 'javascript:alert(1)', shot(2)], true)).toEqual({ ok: false, code: 'SCREENSHOT_INVALID' });
    });

    it('counts the list after de-duplicating, so three copies are not three shots', () => {
        expect(normaliseScreenshots([shot(1), shot(1), shot(1)], true)).toEqual({ ok: false, code: 'SCREENSHOTS_FEW' });
    });
});

describe('validateVideoUrl', () => {
    it('is optional', () => {
        expect(validateVideoUrl(undefined)).toEqual({ ok: true, value: null });
        expect(validateVideoUrl('')).toEqual({ ok: true, value: null });
        expect(validateVideoUrl('   ')).toEqual({ ok: true, value: null });
    });

    it('accepts YouTube and Vimeo, including their subdomains', () => {
        expect(validateVideoUrl('https://www.youtube.com/watch?v=abc123').ok).toBe(true);
        expect(validateVideoUrl('https://youtu.be/abc123').ok).toBe(true);
        expect(validateVideoUrl('https://vimeo.com/123456').ok).toBe(true);
        expect(validateVideoUrl('https://player.vimeo.com/video/123456').ok).toBe(true);
    });

    it('refuses a host that only looks like an allowed one', () => {
        expect(validateVideoUrl('https://youtube.com.evil.example/watch?v=a'))
            .toEqual({ ok: false, code: 'VIDEO_HOST_NOT_ALLOWED' });
        expect(validateVideoUrl('https://notvimeo.com/123'))
            .toEqual({ ok: false, code: 'VIDEO_HOST_NOT_ALLOWED' });
    });

    it('refuses anything that is not an https URL', () => {
        expect(validateVideoUrl('http://www.youtube.com/watch?v=a')).toEqual({ ok: false, code: 'VIDEO_URL_INVALID' });
        expect(validateVideoUrl('javascript:alert(1)')).toEqual({ ok: false, code: 'VIDEO_URL_INVALID' });
        expect(validateVideoUrl('youtube.com/watch?v=a')).toEqual({ ok: false, code: 'VIDEO_URL_INVALID' });
    });

    it('refuses another video host, so the embed list stays a code review', () => {
        expect(validateVideoUrl('https://rutube.ru/video/abc/')).toEqual({ ok: false, code: 'VIDEO_HOST_NOT_ALLOWED' });
    });
});
