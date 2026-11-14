/**
 * GET /api/badge/<handle>.svg -- the member badge, for anywhere else.
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
import { prisma } from '../db/index.js';
import { validateHandle } from '../config/profile.js';
import { autoHandle } from '../config/public-name.js';
import { badgeAvatar } from '../services/badge-avatar.js';
import { markDataUri } from '../services/badge-mark.js';
import { buildBadge } from '../services/member-badge.js';

const router = express.Router();

/** Drawing one costs an image resize, so a built badge is kept for a while. */
const badges = new NodeCache({ stdTTL: 600, maxKeys: 500 });

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

/** How the badge is served: as an image, cacheable, readable from anywhere. */
function sendBadge(res: Response, svg: string) {
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(svg);
}

router.get('/:file', async (req: Request, res: Response) => {
    const asked = req.params.file;

    if (!asked.toLowerCase().endsWith('.svg')) {
        return res.status(404).type('text/plain').send('The badge is at /api/badge/<handle>.svg');
    }

    const idOrHandle = asked.slice(0, -4);

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
        const key = `${member.id}|${label}|${member.avatarUrl ?? ''}|${name ?? ''}`;
        const cached = badges.get<string>(key);
        if (cached) return sendBadge(res, cached);

        const [avatar, mark] = await Promise.all([
            badgeAvatar({ id: member.id, avatarUrl: member.avatarUrl, name, address }),
            markDataUri(),
        ]);

        const svg = buildBadge({ label, avatar, key: label }, mark);
        try {
            badges.set(key, svg);
        } catch {
            // The cache is full: serving it is what matters, not keeping it.
        }

        return sendBadge(res, svg);
    } catch (error) {
        console.error('badge: could not build the badge for', idOrHandle, error);
        return res.status(500).type('text/plain').send('Could not draw the badge.');
    }
});

export default router;
