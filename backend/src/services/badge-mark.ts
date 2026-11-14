/**
 * The ZEROxWORK mark, inlined into the badge.
 *
 * It is the site's own artwork (frontend/public/zx-mark.png), read once and
 * kept in memory shrunk to twice the size the badge draws it at: big enough to
 * stay sharp on a retina screen, small enough that the badge file stays a
 * badge -- around ten kilobytes of the twenty it weighs.
 *
 * Reading the real file rather than keeping a copy here means the badge
 * follows the logo: change the artwork and the next restart picks it up. If it
 * cannot be read the badge is drawn without it, which is worse than the real
 * thing but better than a hole or a wrong mark.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** backend/src/services -> the repository root -> the frontend's static files. */
const MARK_FILE = path.join(__dirname, '../../../frontend/public/zx-mark.png');

/** The badge draws the mark about 94 wide; this is twice that. */
const MARK_PX = 190;

let cached: string | null | undefined;

/** The mark as a data URI, or null when the artwork cannot be read. */
export async function markDataUri(): Promise<string | null> {
    if (cached !== undefined) return cached;

    try {
        const source = await fs.readFile(MARK_FILE);
        const png = await sharp(source)
            .resize(MARK_PX, null, { fit: 'inside' })
            .png({ palette: true, quality: 85, compressionLevel: 9 })
            .toBuffer();
        cached = `data:image/png;base64,${png.toString('base64')}`;
    } catch (error) {
        console.error('badge: could not read the mark at', MARK_FILE, error);
        cached = null;
    }

    return cached;
}
