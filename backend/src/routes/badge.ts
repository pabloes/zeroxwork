/**
 * GET /api/badge/<handle>.svg -- the member badge, for anywhere else.
 * GET /api/badge/<handle>.png -- the same drawing, for anywhere that will not
 * take an SVG (a good many forums and chats among them).
 *
 * Public and read-only, like the member page it points at: everything on it
 * (handle, avatar) is already published there. It answers any origin because
 * the whole point is that somebody else's page loads it, and it is a file an
 * <img> can use rather than something a reader has to understand.
 *
 * The badge is built from what the member last saved, so it is cached by what
 * went into it: change the avatar or the handle and the next request draws a
 * new one, without waiting for anything to expire.
 */

import express, { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import NodeCache from 'node-cache';
import sharp from 'sharp';
import { prisma } from '../db/index.js';
import { validateHandle } from '../config/profile.js';
import { autoHandle } from '../config/public-name.js';
import { badgeAvatar } from '../services/badge-avatar.js';
import { markDataUri } from '../services/badge-mark.js';
import { typeface } from '../services/badge-type.js';
import { buildBadge } from '../services/member-badge.js';

const router = express.Router();

/** Drawing one costs an image resize, so a built badge is kept for a while. */
const badges = new NodeCache({ stdTTL: 600, maxKeys: 500 });

/**
 * The PNG is drawn at the badge's own size by default: pasted in a README it
 * should come out the size the card is, not twice it. Anyone who wants it
 * sharp on a dense screen asks for `?scale=2`.
 */
const PNG_DPI = 72;
const MAX_SCALE = 3;

/**
 * A badge on a popular page is fetched by every reader of that page, and each
 * of those is a different address, so this is only here to stop one machine
 * from hammering us. Browsers and the proxies in front of them honour the
 * Cache-Control below long before they get near it.
 */
const badgeLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests.',
});

router.use(badgeLimiter);

/** How a badge is served: as an image, cacheable, readable from anywhere. */
function sendBadge(res: Response, body: string | Buffer, type: 'svg' | 'png') {
    res.setHeader('Content-Type', type === 'svg' ? 'image/svg+xml; charset=utf-8' : 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(body);
}

/** `?scale=2` for a dense screen; anything unreadable is simply 1. */
function readScale(value: unknown): number {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    if (!Number.isFinite(parsed) || parsed < 1) return 1;
    return Math.min(parsed, MAX_SCALE);
}

router.get('/:file', async (req: Request, res: Response) => {
    const asked = req.params.file;
    const dot = asked.lastIndexOf('.');
    const extension = dot === -1 ? '' : asked.slice(dot + 1).toLowerCase();

    if (extension !== 'svg' && extension !== 'png') {
        return res.status(404).type('text/plain').send('The badge is at /api/badge/<handle>.svg or .png');
    }

    const idOrHandle = asked.slice(0, dot);
    const scale = extension === 'png' ? readScale(req.query.scale) : 1;

    // The same two ways in the member page has: the account id always works,
    // the handle is the nicer address the member chose. A handle must contain
    // a letter, so neither can be read as the other.
    let where: { id: number } | { handle: string };
    if (/^\d+$/.test(idOrHandle)) {
        where = { id: Number(idOrHandle) };
    } else {
        const handle = validateHandle(idOrHandle);
        if (!handle.ok || !handle.value) {
            return res.status(404).type('text/plain').send('No such member.');
        }
        where = { handle: handle.value };
    }

    try {
        const member = await prisma.user.findUnique({
            where,
            select: {
                id: true,
                handle: true,
                avatarUrl: true,
                defaultName: { select: { name: true, wallet: { select: { address: true } } } },
            },
        });

        if (!member) {
            return res.status(404).type('text/plain').send('No such member.');
        }

        const label = member.handle ?? autoHandle(member.id);
        const name = member.defaultName?.name ?? null;
        const address = member.defaultName?.wallet?.address ?? null;

        // Everything the drawing depends on, so a saved profile shows at once.
        const drawing = `${member.id}|${label}|${member.avatarUrl ?? ''}|${name ?? ''}`;

        const cachedPng = extension === 'png' ? badges.get<Buffer>(`${drawing}|png${scale}`) : null;
        if (cachedPng) return sendBadge(res, cachedPng, 'png');

        let svg = badges.get<string>(`${drawing}|svg`);
        if (!svg) {
            const [avatar, mark, type] = await Promise.all([
                badgeAvatar({ id: member.id, avatarUrl: member.avatarUrl, name, address }),
                markDataUri(),
                typeface(),
            ]);
            svg = buildBadge({ label, avatar, key: label }, mark, type);
            remember(`${drawing}|svg`, svg);
        }

        if (extension === 'svg') return sendBadge(res, svg, 'svg');

        // Only the outlines can be rasterised: this container has no fonts, so
        // a badge built on the <text> fallback would come out wordless.
        if (!(await typeface())) {
            return res.status(500).type('text/plain').send('The PNG badge is not available right now.');
        }

        const png = await sharp(Buffer.from(svg), { density: PNG_DPI * scale }).png({ compressionLevel: 9 }).toBuffer();
        remember(`${drawing}|png${scale}`, png);
        return sendBadge(res, png, 'png');
    } catch (error) {
        console.error('badge: could not build the badge for', idOrHandle, error);
        return res.status(500).type('text/plain').send('Could not draw the badge.');
    }
});

/** The cache is a convenience: a full one must never fail a request. */
function remember(key: string, value: string | Buffer): void {
    try {
        badges.set(key, value);
    } catch {
        // Over maxKeys. Serving it is what matters, not keeping it.
    }
}

export default router;
