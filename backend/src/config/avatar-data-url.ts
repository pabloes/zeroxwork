/**
 * The avatar picked on the sign-up form arrives inline, as a data URL, because
 * the account that would own an upload does not exist yet: there is no token,
 * so POST /images/upload is closed to it, and nothing can own a file_uploads
 * row before the user row is there.
 *
 * This only turns the string into bytes and refuses what is obviously not an
 * image. What the bytes actually are is decided downstream by the normal
 * pipeline, which sniffs the file signature, scans it for viruses and runs the
 * content check -- the same one every other upload goes through.
 */

/**
 * The form squares the picture off at 512 px before sending it, which lands
 * well under this. The cap is here to refuse abuse, not to size avatars: the
 * JSON body limit is 2 MB and base64 adds a third on top of the raw bytes.
 */
export const AVATAR_MAX_BYTES = 1024 * 1024;

const DATA_URL = /^data:image\/[a-z+]+;base64,([A-Za-z0-9+/]+={0,2})$/;

/** The bytes behind a data URL, or null when it is not one we will look at. */
export function avatarBuffer(input: unknown): Buffer | null {
    if (typeof input !== 'string') return null;

    const trimmed = input.trim();
    if (trimmed === '') return null;

    const match = DATA_URL.exec(trimmed);
    if (!match) return null;

    const buffer = Buffer.from(match[1], 'base64');
    if (buffer.length === 0 || buffer.length > AVATAR_MAX_BYTES) return null;

    // Buffer.from ignores what it cannot decode, so a string that survived the
    // pattern but is not valid base64 would come back quietly truncated. Round
    // trip it: anything that does not come out the same was not base64.
    if (buffer.toString('base64').replace(/=+$/, '') !== match[1].replace(/=+$/, '')) return null;

    return buffer;
}
