/**
 * The bit of opentype.js the badge uses.
 *
 * The package ships no types of its own, and the ones on DefinitelyTyped are
 * written against version 1. This declares the few calls we make and nothing
 * else, so a wrong signature shows up here rather than at runtime.
 */
declare module 'opentype.js' {
    /** One drawing instruction. The absent fields belong to the other types. */
    export interface PathCommand {
        type: 'M' | 'L' | 'C' | 'Q' | 'Z';
        x?: number;
        y?: number;
        x1?: number;
        y1?: number;
        x2?: number;
        y2?: number;
    }

    export interface Path {
        commands: PathCommand[];
        toPathData(options?: number | Record<string, unknown>): string;
    }

    export interface Font {
        unitsPerEm: number;
        ascender: number;
        descender: number;
        getPath(text: string, x: number, y: number, fontSize: number, options?: Record<string, unknown>): Path;
        getAdvanceWidth(text: string, fontSize: number, options?: Record<string, unknown>): number;
        charToGlyphIndex(char: string): number;
        tables: { os2?: { sCapHeight?: number; sxHeight?: number } };
    }

    function parse(buffer: ArrayBuffer, options?: Record<string, unknown>): Font;

    const opentype: { parse: typeof parse };
    export default opentype;
}
