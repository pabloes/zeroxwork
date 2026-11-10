import { describe, it, expect } from 'vitest';
import { AVATAR_MAX_BYTES, avatarBuffer } from '../src/config/avatar-data-url.js';

/** A data URL carrying these exact bytes, with the header the form sends. */
function dataUrl(bytes: Buffer, mime = 'image/jpeg'): string {
    return `data:${mime};base64,${bytes.toString('base64')}`;
}

const JPEG_START = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

describe('avatar data URL', () => {
    it('gives back the bytes the form put in', () => {
        expect(avatarBuffer(dataUrl(JPEG_START))).toEqual(JPEG_START);
    });

    it('accepts the mime types the form can produce', () => {
        for (const mime of ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']) {
            expect(avatarBuffer(dataUrl(JPEG_START, mime))).toEqual(JPEG_START);
        }
    });

    // Nothing here says the bytes are an image; the upload pipeline sniffs the
    // signature afterwards. This is only the envelope.
    it('ignores anything that is not an image data URL', () => {
        for (const bad of [
            null, undefined, 42, {}, '',
            '   ',
            'https://example.com/avatar.jpg',
            '/api/images/user-uploaded-images/abc.jpg',
            'data:text/html;base64,' + Buffer.from('<script>').toString('base64'),
            'data:application/pdf;base64,' + Buffer.from('%PDF').toString('base64'),
            'data:image/jpeg,' + Buffer.from('not base64').toString('base64'), // no ;base64
        ]) {
            expect(avatarBuffer(bad)).toBeNull();
        }
    });

    it('refuses an empty payload', () => {
        expect(avatarBuffer('data:image/jpeg;base64,')).toBeNull();
    });

    // Buffer.from drops what it cannot decode, so a payload that looks like
    // base64 but is not must not come back silently truncated.
    it('refuses a payload that is not really base64', () => {
        expect(avatarBuffer('data:image/jpeg;base64,abcde')).toBeNull();
        expect(avatarBuffer('data:image/jpeg;base64,a')).toBeNull();
    });

    it('refuses whitespace and newlines inside the payload', () => {
        const chunked = JPEG_START.toString('base64');
        expect(avatarBuffer(`data:image/jpeg;base64,${chunked.slice(0, 2)}\n${chunked.slice(2)}`)).toBeNull();
    });

    // The JSON body limit is 2 MB; this keeps one request from eating it.
    it('refuses anything over the cap, and takes what fits', () => {
        const tooBig = Buffer.alloc(AVATAR_MAX_BYTES + 1, 7);
        expect(avatarBuffer(dataUrl(tooBig))).toBeNull();

        const justFits = Buffer.alloc(AVATAR_MAX_BYTES, 7);
        expect(avatarBuffer(dataUrl(justFits))?.length).toBe(AVATAR_MAX_BYTES);
    });

    it('tolerates the surrounding whitespace a paste can leave', () => {
        expect(avatarBuffer(`  ${dataUrl(JPEG_START)}  `)).toEqual(JPEG_START);
    });
});
