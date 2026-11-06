import { describe, it, expect } from 'vitest';
import { detectImageType } from '../src/routes/image.js';

const withHeader = (bytes: number[], length = 64) => {
    const buffer = Buffer.alloc(length);
    Buffer.from(bytes).copy(buffer);
    return buffer;
};

const JPEG = withHeader([0xff, 0xd8, 0xff, 0xe0]);
const PNG = withHeader([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const GIF = withHeader([...Buffer.from('GIF89a')]);
const WEBP = withHeader([...Buffer.from('RIFF'), 0, 0, 0, 0, ...Buffer.from('WEBP')]);
const AVIF = withHeader([0, 0, 0, 0x20, ...Buffer.from('ftyp'), ...Buffer.from('avif')]);

describe('detectImageType', () => {
    it('recognises the formats we serve', () => {
        expect(detectImageType(JPEG)?.ext).toBe('jpg');
        expect(detectImageType(PNG)?.ext).toBe('png');
        expect(detectImageType(GIF)?.ext).toBe('gif');
        expect(detectImageType(WEBP)?.ext).toBe('webp');
        expect(detectImageType(AVIF)?.ext).toBe('avif');
    });

    it('rejects svg, which is markup and could carry scripts', () => {
        const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
        expect(detectImageType(svg)).toBeNull();
    });

    it('rejects html dressed up as an image', () => {
        const html = Buffer.from('<!doctype html><script>alert(1)</script>');
        expect(detectImageType(html)).toBeNull();
    });

    it('ignores the file name: a png renamed to .jpg is still a png', () => {
        expect(detectImageType(PNG)?.ext).toBe('png');
    });

    it('rejects anything too short to identify', () => {
        expect(detectImageType(Buffer.from([0xff, 0xd8]))).toBeNull();
    });
});
