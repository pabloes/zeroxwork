/**
 * The badge's lettering, as outlines.
 *
 * The badge is read by machines that have never heard of our fonts: another
 * site's browser, and our own container, which has no fonts installed at all.
 * So the words are not text in the file -- they are the shapes of the words,
 * measured and drawn here from Space Grotesk, the same face the site sets its
 * headings in.
 *
 * Two things fall out of that. A badge looks the same everywhere, instead of
 * landing in whatever the reader happens to have; and the badge can be turned
 * into a PNG on a machine with no fonts, which is what makes /api/badge/<x>.png
 * possible at all.
 *
 * The fonts live in backend/assets/fonts under the SIL Open Font License, whose
 * text is beside them. They are read once and kept.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import opentype from 'opentype.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONT_DIR = path.join(__dirname, '../../assets/fonts');

export type Weight = 'bold' | 'medium';

const FILES: Record<Weight, string> = {
    bold: 'SpaceGrotesk-Bold.otf',
    medium: 'SpaceGrotesk-Medium.otf',
};

/** What a line of lettering comes out as: its shapes and how wide they are. */
export interface Lettering {
    /** Path data, already positioned, ready to drop into a <path d="...">. */
    d: string;
    /** How far the line runs from where it started. */
    width: number;
}

export interface Typeface {
    line(text: string, size: number, weight: Weight, x: number, baseline: number): Lettering;
    width(text: string, size: number, weight: Weight): number;
    /** Cap height as a fraction of the size, for centring a line by its caps. */
    capRatio: number;
}

let loading: Promise<Typeface | null> | null = null;

async function readFont(file: string) {
    const bytes = await fs.readFile(path.join(FONT_DIR, file));
    // opentype wants an ArrayBuffer of exactly these bytes; a Node Buffer is a
    // view into a shared pool, so hand over its slice, not the whole pool.
    return opentype.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
}

/**
 * The typeface, read once. Null when the files cannot be read, so the caller
 * can decide: the SVG falls back to ordinary text, the PNG cannot and says so.
 */
export function typeface(): Promise<Typeface | null> {
    if (loading) return loading;

    loading = (async () => {
        try {
            const [bold, medium] = await Promise.all([readFont(FILES.bold), readFont(FILES.medium)]);
            const fonts = { bold, medium };

            const capHeight = bold.tables.os2?.sCapHeight ?? 700;

            return {
                line(text, size, weight, x, baseline) {
                    const font = fonts[weight];
                    return {
                        d: font.getPath(text, x, baseline, size).toPathData(2),
                        width: font.getAdvanceWidth(text, size),
                    };
                },
                width(text, size, weight) {
                    return fonts[weight].getAdvanceWidth(text, size);
                },
                capRatio: capHeight / bold.unitsPerEm,
            };
        } catch (error) {
            console.error('badge: could not read the fonts in', FONT_DIR, error);
            return null;
        }
    })();

    return loading;
}
