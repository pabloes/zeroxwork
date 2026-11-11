import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { prisma } from '../db';
import { verifyToken } from '../middleware/authMiddleware';
import { enqueueDiscordSync } from '../services/discord-sync-queue';
import {
    DiscordOAuthError,
    buildAuthorizeUrl,
    getDiscordConfig,
    isDiscordConfigured,
    resolveProfileFromCode,
    signState,
    verifyState,
} from '../services/discord-oauth';

const router = Router();

/** Where the browser lands after the Discord round trip. Same origin, so relative. */
const ACCOUNT_PATH = '/account';

const startLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { message: 'Too many requests. Try again later.' },
});

// unauthenticated by nature: Discord redirects the browser here
const callbackLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 40,
    message: { message: 'Too many requests. Try again later.' },
});

function backToAccount(res: Response, status: string) {
    return res.redirect(`${ACCOUNT_PATH}?discord=${encodeURIComponent(status)}`);
}

/**
 * GET /api/discord/link
 * Current link for the signed-in user, plus whether the integration is live at all.
 */
router.get('/link', verifyToken, async (req: Request, res: Response) => {
    try {
        const link = await prisma.discordLink.findUnique({
            where: { userId: req.user.id },
            select: { discordId: true, username: true, globalName: true, avatar: true, linkedAt: true },
        });
        res.json({ configured: isDiscordConfigured(), link });
    } catch (error) {
        console.error('Discord link lookup failed');
        res.status(500).json({ message: 'Could not read the Discord link' });
    }
});

/**
 * POST /api/discord/oauth/start
 * Returns the authorize URL. The user id travels signed inside `state`, so the
 * callback never has to trust the query string.
 */
router.post('/oauth/start', verifyToken, startLimiter, (req: Request, res: Response) => {
    const config = getDiscordConfig();
    if (!config) {
        return res.status(503).json({ message: 'Discord integration is not configured' });
    }
    res.json({ url: buildAuthorizeUrl(signState(req.user.id, config), config) });
});

/**
 * GET /api/discord/oauth/callback
 * Discord sends the browser here. Always ends in a redirect, never a JSON body.
 */
router.get('/oauth/callback', callbackLimiter, async (req: Request, res: Response) => {
    const config = getDiscordConfig();
    if (!config) {
        return backToAccount(res, 'not_configured');
    }

    const { code, state, error } = req.query;
    if (error) {
        return backToAccount(res, 'denied');
    }
    if (typeof code !== 'string' || typeof state !== 'string') {
        return backToAccount(res, 'invalid_request');
    }

    let userId: number;
    try {
        userId = verifyState(state, config);
    } catch (err) {
        const code = err instanceof DiscordOAuthError ? err.code : 'invalid_state';
        return backToAccount(res, code);
    }

    try {
        const profile = await resolveProfileFromCode(code, config);

        const taken = await prisma.discordLink.findUnique({
            where: { discordId: profile.id },
            select: { userId: true },
        });
        if (taken && taken.userId !== userId) {
            return backToAccount(res, 'already_linked');
        }

        await prisma.discordLink.upsert({
            where: { userId },
            create: {
                userId,
                discordId: profile.id,
                username: profile.username,
                globalName: profile.globalName,
                avatar: profile.avatar,
            },
            update: {
                discordId: profile.id,
                username: profile.username,
                globalName: profile.globalName,
                avatar: profile.avatar,
            },
        });

        await enqueueDiscordSync(profile.id, 'linked');
        return backToAccount(res, 'linked');
    } catch (err) {
        if (err instanceof DiscordOAuthError) {
            console.error(`Discord OAuth callback failed: ${err.code}`);
            return backToAccount(res, err.code);
        }
        // a race on either unique index lands here
        if ((err as { code?: string }).code === 'P2002') {
            return backToAccount(res, 'already_linked');
        }
        console.error('Discord OAuth callback failed with an unexpected error');
        return backToAccount(res, 'error');
    }
});

/**
 * DELETE /api/discord/link
 * Unlinking only ever touches the caller's own row.
 */
router.delete('/link', verifyToken, async (req: Request, res: Response) => {
    try {
        // the id has to be read before the delete: afterwards there is no trace
        const link = await prisma.discordLink.findUnique({
            where: { userId: req.user.id },
            select: { discordId: true },
        });
        const removed = await prisma.discordLink.deleteMany({ where: { userId: req.user.id } });
        if (link && removed.count > 0) {
            await enqueueDiscordSync(link.discordId, 'unlinked');
        }
        res.json({ unlinked: removed.count > 0 });
    } catch (error) {
        console.error('Discord unlink failed');
        res.status(500).json({ message: 'Could not unlink the Discord account' });
    }
});

export default router;
