/**
 * The member badge: one picture a member can paste on somebody else's site.
 *
 * It is a single file with nothing outside it -- the avatar arrives inlined,
 * the mark is the site's own artwork inlined, and the words are the shapes of
 * the words, drawn from Space Grotesk in badge-type.ts. That is the whole
 * point: an <img> on another domain renders an SVG with its external
 * references stripped, and the fonts a reader happens to have are not ours.
 *
 * Because the lettering is outlines, the same drawing rasterises to PNG on a
 * machine with no fonts installed, which is how /api/badge/<handle>.png works
 * at all. When the fonts cannot be read the SVG falls back to ordinary text,
 * measured by the estimate below; the PNG, which cannot, says so instead.
 *
 * The width is computed from the handle rather than fixed: a thirty-character
 * handle needs twice the room "pablo" does.
 */

import { BadgeAvatar, escapeXml } from './badge-avatar.js';
import { Typeface } from './badge-type.js';

/* ---------- the geometry, all in the badge's own units ---------- */

/** The whole picture. The extra 6 on each side is room for the shadow. */
const HEIGHT = 120;
const PAD = 6;
const PILL_H = HEIGHT - PAD * 2;

const RING_CX = 66;
const RING_CY = 60;
/** Outer edge of the spectrum ring, and how thick it is. */
const RING_R = 44.5;
const RING_W = 7;
const AVATAR_R = RING_R - RING_W;

const TEXT_X = 134;
const LABEL_SIZE = 33;
const SITE_SIZE = 24;
/** Between the handle's baseline and the top of the caps underneath it. */
const LINE_GAP = 11;
const SITE_TEXT = 'ZEROxWORK.com';

/** Cap height over em in Space Grotesk; only used when the fonts are missing. */
const CAP_RATIO = 0.7;

/** The mark keeps the artwork's 240x136 proportions. */
const MARK_H = 53;
const MARK_SCALE = MARK_H / 136;
const MARK_W = 240 * MARK_SCALE;
const TEXT_TO_MARK = 29;
const MARK_TO_EDGE = 18;

/** Nothing narrower than the artwork, nothing wider than a long handle needs. */
const MIN_WIDTH = 400;
const MAX_WIDTH = 900;

/* ---------- colours ---------- */

const CARD = '#FFFFFF';
const CARD_LINE = '#D4D6DA';
const LABEL_INK = '#23282E';
const SITE_INK = '#1A1F24';
/** The "0" disc, ink on a light card, as --zx-zero is in the light theme. */
const ZERO_INK = '#15222B';

/**
 * The spectrum ring, sampled every 20 degrees clockwise from the top off the
 * artwork. Kept as measured colours rather than a formula: the wheel is not a
 * plain hue sweep -- it lingers in the oranges and hurries through the blues.
 */
const RING_STOPS = [
    '#F4613A', '#ED3F63', '#D03774', '#C92C95', '#8A51C3', '#4A70ED',
    '#0890FC', '#02AAF9', '#07CDFF', '#20DAD8', '#49E7B1', '#67E975',
    '#A5EA3B', '#D3E016', '#FBCC09', '#FDBB0A', '#FCA504', '#FD860E',
];

/* ---------- the mark, measured from public/zx-mark.png (240x136) ---------- */

const ZERO_C = { x: 65.84, y: 69.14, r: 66.34 };
const HOLE_R = 33;
const BAR_H = 28.3;

/** The "0" ring with its bar, as one path, exactly as the site draws it. */
const zeroRing = `M${ZERO_C.x - ZERO_C.r} ${ZERO_C.y}a${ZERO_C.r} ${ZERO_C.r} 0 1 0 ${ZERO_C.r * 2} 0`
    + `a${ZERO_C.r} ${ZERO_C.r} 0 1 0 ${-ZERO_C.r * 2} 0Z`
    + `M${ZERO_C.x - HOLE_R} ${ZERO_C.y}a${HOLE_R} ${HOLE_R} 0 1 0 ${HOLE_R * 2} 0`
    + `a${HOLE_R} ${HOLE_R} 0 1 0 ${-HOLE_R * 2} 0Z`;

const zeroDisc = `M${ZERO_C.x - ZERO_C.r} ${ZERO_C.y}a${ZERO_C.r} ${ZERO_C.r} 0 1 0 ${ZERO_C.r * 2} 0`
    + `a${ZERO_C.r} ${ZERO_C.r} 0 1 0 ${-ZERO_C.r * 2} 0Z`;

/* ---------- measuring text when there is no font to measure with ---------- */

const NARROW = new Set([...'iljtfr.,:;!|\'`-1 ']);
const WIDE = new Set([...'mwMW@%']);

/**
 * Roughly how wide a string sets, in multiples of the font size. Only used
 * when the fonts could not be read: then the badge falls back to <text>, and
 * this is what keeps the words inside the card.
 */
export function textWidth(text: string, size: number): number {
    let units = 0;
    for (const char of text) {
        if (char === ' ') units += 0.30;
        else if (NARROW.has(char)) units += 0.40;
        else if (WIDE.has(char)) units += 0.90;
        else if (char >= 'A' && char <= 'Z') units += 0.70;
        else units += 0.54;
    }
    return units * size;
}

export interface BadgeInput {
    /** The line in large type: the handle, which is also its address. */
    label: string;
    avatar: BadgeAvatar;
    /** Only used to keep ids apart when two badges land in the same document. */
    key?: string;
}

/** A point on the ring, in badge units. */
function ringPoint(degrees: number, radius: number): [number, number] {
    const radians = ((degrees - 90) * Math.PI) / 180;
    return [
        RING_CX + Math.cos(radians) * radius,
        RING_CY + Math.sin(radians) * radius,
    ];
}

/**
 * The spectrum ring: one arc per sampled colour, each carrying a gradient to
 * the next, so the wheel comes out continuous instead of banded. SVG has no
 * conic gradient, and this is what it would have been.
 */
function spectrumRing(id: string): string {
    const radius = RING_R - RING_W / 2;
    const step = 360 / RING_STOPS.length;
    let gradients = '';
    let arcs = '';

    RING_STOPS.forEach((color, index) => {
        const next = RING_STOPS[(index + 1) % RING_STOPS.length];
        const from = index * step;
        // A hair of overlap on each side, or the seams show as white hairlines.
        const [x0, y0] = ringPoint(from - 0.6, radius);
        const [x1, y1] = ringPoint(from + step + 0.6, radius);
        const [gx0, gy0] = ringPoint(from, radius);
        const [gx1, gy1] = ringPoint(from + step, radius);

        gradients += `<linearGradient id="${id}-g${index}" gradientUnits="userSpaceOnUse"`
            + ` x1="${gx0.toFixed(2)}" y1="${gy0.toFixed(2)}" x2="${gx1.toFixed(2)}" y2="${gy1.toFixed(2)}">`
            + `<stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="${next}"/></linearGradient>`;

        arcs += `<path d="M${x0.toFixed(2)} ${y0.toFixed(2)} A${radius} ${radius} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}"`
            + ` fill="none" stroke="url(#${id}-g${index})" stroke-width="${RING_W}"/>`;
    });

    return `<defs>${gradients}</defs>${arcs}`;
}

/** The avatar, clipped round, whatever it turned out to be. */
function avatarArt(avatar: BadgeAvatar, id: string): string {
    const clip = `<clipPath id="${id}-av"><circle cx="${RING_CX}" cy="${RING_CY}" r="${AVATAR_R}"/></clipPath>`;
    const box = AVATAR_R * 2;
    const x = RING_CX - AVATAR_R;
    const y = RING_CY - AVATAR_R;

    if (avatar.kind === 'photo') {
        return `<defs>${clip}</defs>`
            + `<image href="${avatar.dataUri}" x="${x}" y="${y}" width="${box}" height="${box}"`
            + ` preserveAspectRatio="xMidYMid slice" clip-path="url(#${id}-av)"/>`;
    }

    // Drawn in its own 100x100 box, the same one the site generates.
    const scale = box / 100;
    return `<defs>${clip}</defs>`
        + `<g clip-path="url(#${id}-av)">`
        + `<circle cx="${RING_CX}" cy="${RING_CY}" r="${AVATAR_R}" fill="${avatar.fill}"/>`
        + `<g transform="translate(${x} ${y}) scale(${scale.toFixed(4)})">${avatar.body}</g>`
        + `</g>`;
}

/**
 * The ZEROxWORK mark: the artwork for the X disc, with the "0" cut out of it
 * and redrawn as vector on top -- the raster has that disc clipped by the X,
 * and on a light card it has to read as ink. Same construction as ZxMark.tsx.
 *
 * `markImage` is the artwork already inlined as a data URI. Without it the
 * mark is left out rather than drawn wrong.
 */
function markArt(x: number, y: number, id: string, markImage: string | null): string {
    if (!markImage) return '';

    const cut = `<clipPath id="${id}-cut" clipPathUnits="userSpaceOnUse">`
        + `<path clip-rule="evenodd" d="M0 0H240V136H0Z ${zeroDisc}"/></clipPath>`;
    const zero = `<clipPath id="${id}-zero" clipPathUnits="userSpaceOnUse">`
        + `<circle cx="${ZERO_C.x}" cy="${ZERO_C.y}" r="${ZERO_C.r}"/></clipPath>`;

    return `<defs>${cut}${zero}</defs>`
        + `<g transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${MARK_SCALE.toFixed(5)})">`
        + `<image href="${markImage}" x="0" y="0" width="240" height="136" clip-path="url(#${id}-cut)"/>`
        // Keeps the two discs apart when both are dark, as the card does.
        + `<circle cx="${ZERO_C.x}" cy="${ZERO_C.y}" r="${ZERO_C.r}" fill="none" stroke="${CARD}" stroke-width="3.4"/>`
        + `<g clip-path="url(#${id}-zero)" fill="${ZERO_INK}">`
        + `<path fill-rule="evenodd" d="${zeroRing}"/>`
        + `<rect x="${ZERO_C.x - ZERO_C.r}" y="${ZERO_C.y - BAR_H / 2}" width="${ZERO_C.r * 2}" height="${BAR_H}"`
        + ` transform="rotate(-45 ${ZERO_C.x} ${ZERO_C.y})"/>`
        + `</g></g>`;
}

/**
 * How the two lines are laid out: their size, where their baselines sit, and
 * how much room they take. With the real fonts everything is measured; without
 * them the handle is squeezed to fit instead, which is all <text> allows.
 */
export function badgeLayout(label: string, type: Typeface | null) {
    const room = MAX_WIDTH - TEXT_X - TEXT_TO_MARK - MARK_W - MARK_TO_EDGE - PAD;

    const measure = (text: string, size: number, bold: boolean) =>
        type ? type.width(text, size, bold ? 'bold' : 'medium') : textWidth(text, size);

    // A handle longer than the widest card allows is set smaller rather than
    // run into the mark. Handles stop at 30 characters, so this is a guard.
    let labelSize = LABEL_SIZE;
    let labelW = measure(label, labelSize, true);
    if (labelW > room) {
        labelSize = Math.max(10, (labelSize * room) / labelW);
        labelW = Math.min(measure(label, labelSize, true), room);
    }

    const siteW = measure(SITE_TEXT, SITE_SIZE, false);
    const capRatio = type?.capRatio ?? CAP_RATIO;

    // Centred on the caps, the way the eye reads a card like this: a line with
    // no descenders should not look as if it is sitting high.
    const labelCap = labelSize * capRatio;
    const siteCap = SITE_SIZE * capRatio;
    const top = RING_CY - (labelCap + LINE_GAP + siteCap) / 2;

    return {
        labelSize,
        labelW,
        siteW,
        labelBase: top + labelCap,
        siteBase: top + labelCap + LINE_GAP + siteCap,
        width: Math.round(Math.min(Math.max(
            TEXT_X + Math.max(labelW, siteW) + TEXT_TO_MARK + MARK_W + MARK_TO_EDGE + PAD,
            MIN_WIDTH), MAX_WIDTH)),
    };
}

/** How wide the badge comes out for a given label. */
export function badgeWidth(label: string, type: Typeface | null = null): number {
    return badgeLayout(label, type).width;
}

/** The badge, as a whole SVG document. */
export function buildBadge(
    { label, avatar, key }: BadgeInput,
    markImage: string | null,
    type: Typeface | null = null,
): string {
    const id = `zx${(key ?? label).replace(/[^a-z0-9]/gi, '').slice(0, 20) || 'badge'}`;
    const box = badgeLayout(label, type);

    const markX = box.width - PAD - MARK_TO_EDGE - MARK_W;
    const markY = RING_CY - MARK_H / 2;
    const alt = `${label} on ZEROxWORK.com`;

    // Outlines when we have the fonts; ordinary text, pinned to the width we
    // guessed, when we do not -- or when the shapes come back unusable.
    const labelLine = type?.line(label, box.labelSize, 'bold', TEXT_X, box.labelBase) ?? null;
    const siteLine = type?.line(SITE_TEXT, SITE_SIZE, 'medium', TEXT_X, box.siteBase) ?? null;

    const words = labelLine && siteLine
        ? `<path d="${labelLine.d}" fill="${LABEL_INK}"/>`
          + `<path d="${siteLine.d}" fill="${SITE_INK}"/>`
        : `<text x="${TEXT_X}" y="${box.labelBase.toFixed(1)}" textLength="${box.labelW.toFixed(1)}"`
          + ` lengthAdjust="spacingAndGlyphs" font-family="'Space Grotesk','Helvetica Neue',Helvetica,Arial,sans-serif"`
          + ` font-size="${box.labelSize.toFixed(1)}" font-weight="700" fill="${LABEL_INK}">${escapeXml(label)}</text>`
          + `<text x="${TEXT_X}" y="${box.siteBase.toFixed(1)}" textLength="${box.siteW.toFixed(1)}"`
          + ` lengthAdjust="spacingAndGlyphs" font-family="'Space Grotesk','Helvetica Neue',Helvetica,Arial,sans-serif"`
          + ` font-size="${SITE_SIZE}" font-weight="500" fill="${SITE_INK}">${SITE_TEXT}</text>`;

    return `<svg xmlns="http://www.w3.org/2000/svg"`
        + ` width="${box.width}" height="${HEIGHT}" viewBox="0 0 ${box.width} ${HEIGHT}" role="img" aria-label="${escapeXml(alt)}">`
        + `<title>${escapeXml(alt)}</title>`
        + `<defs><filter id="${id}-shadow" x="-10%" y="-20%" width="120%" height="150%">`
        + `<feDropShadow dx="0" dy="3" stdDeviation="4.5" flood-color="#0B0F13" flood-opacity="0.16"/></filter></defs>`
        + `<rect x="${PAD}" y="${PAD}" width="${box.width - PAD * 2}" height="${PILL_H}" rx="${PILL_H / 2}"`
        + ` fill="${CARD}" stroke="${CARD_LINE}" stroke-width="1" filter="url(#${id}-shadow)"/>`
        + spectrumRing(id)
        + avatarArt(avatar, id)
        + words
        + markArt(markX, markY, id, markImage)
        + `</svg>`;
}
