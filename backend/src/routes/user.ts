import { Router, Request, Response } from 'express';
import { verifyToken } from '../middleware/authMiddleware';
const router = Router();
import {prisma} from "../db";
import { SOCIAL_NETWORKS } from '../constants/social-networks';
import { PORTFOLIO_CATEGORY } from '../constants/portfolio-seed.js';
import NodeCache from 'node-cache';
import { effectiveMaxQuota } from '../services/quota.js';
import axios from "axios";
import sharp from "sharp";
import {
    validateDisplayName,
    validateHandle,
    avatarUrlHash,
    AVATAR_URL_PREFIX,
    DISPLAY_NAME_MIN,
    DISPLAY_NAME_MAX,
    HANDLE_MIN,
    HANDLE_MAX,
} from "../config/profile.js";
import { resolvePublicName, autoHandle } from "../config/public-name.js";
import { ensureHandle } from "../services/public-handle.js";

const cache = new NodeCache({ stdTTL: 60 * 60 * 24 }); // Cache expires in 24 hours
const DECENTRALAND_API_URL = 'https://peer.decentraland.org/lambdas/profiles';

const DISPLAY_NAME_ERRORS = {
    DISPLAY_NAME_LENGTH: `Display name must be between ${DISPLAY_NAME_MIN} and ${DISPLAY_NAME_MAX} characters.`,
    DISPLAY_NAME_INVALID: 'Display name contains characters that are not allowed.',
    DISPLAY_NAME_EMAIL: 'Display name cannot be an email address.',
};

const HANDLE_ERRORS = {
    HANDLE_LENGTH: `The handle must be between ${HANDLE_MIN} and ${HANDLE_MAX} characters.`,
    HANDLE_INVALID: 'The handle can only use lowercase letters, numbers and single hyphens, and must contain at least one letter.',
    HANDLE_RESERVED: 'That handle is reserved.',
};

/** What a member page needs to know about each piece of work. */
const WORK_SELECT = {
    id: true,
    title: true,
    slug: true,
    lang: true,
    thumbnail: true,
    createdAt: true,
    featured: true,
    category: { select: { name: true } },
    tags: { select: { id: true, name: true } },
    translations: { select: { targetLang: true, title: true, slug: true } },
} as const;

/**
 * GET /api/user/social-networks
 * Public on purpose: the sign-up form needs it before anyone has a token.
 * Keeps the catalogue in one place instead of a copy inside the frontend.
 */
router.get('/social-networks', (_req: Request, res: Response) => {
    res.json({ networks: SOCIAL_NETWORKS });
});

router.get('/me', verifyToken, async (req: Request, res: Response) => {
    try {
        // Fetch the authenticated user's information
        // Accounts that predate automatic handles, and accounts that have since
        // linked Discord or bought a name, get their handle here: this runs on
        // every visit to the account page and does nothing once the handle is a
        // real one. Cheaper than a one-off backfill that has to be remembered.
        await ensureHandle(req.user.id);

        const user = await prisma.user.findUnique({
            where: { id: req.user.id },  // `req.user.id` is set by `verifyToken` middleware
            include: {
                discordLink: { select: { globalName: true, username: true } },
                defaultName: { // This refers to the relation in the Prisma schema
                    select: {
                        id: true,
                        name: true,
                        wallet: { // Fetch the wallet information associated with this name
                            select: {
                                address: true,
                            },
                        },
                    },
                },
            },
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Construct the response payload
        const response = {
            id: user.id,
            email: user.email,
            // `displayName` is what they typed, so the form shows an empty field
            // when they never set one. `publicName` is what the site actually
            // shows: their name, else Discord, else their on-chain name, else
            // the automatic handle. The email is never either of them.
            displayName: user.displayName ?? null,
            publicName: resolvePublicName(user),
            avatarUrl: user.avatarUrl ?? null,
            handle: user.handle ?? null,
            defaultName: user.defaultName ? {
                id: user.defaultName.id,
                name: user.defaultName.name,
                walletAddress: user.defaultName.wallet.address,
            } : null,
        };

        res.json(response); // Return the user information as JSON

    } catch (error) {
        console.error('Error fetching user information:', error);
        res.status(500).json({ message: 'Error fetching user information', error: error.message });
    }
});
router.get('/decentraland-avatar/:address', async (req: Request, res: Response) => {
    const { address } = req.params;

    // Check if the image is cached
    const cachedAvatar = cache.get(address);
    if (cachedAvatar) {
        console.log('Serving cached avatar for:', address);
        res.setHeader('Content-Type', 'image/png');
        return res.send(cachedAvatar);
    }

    try {
        // Fetch avatar data from Decentraland API
        const profileResponse = await axios.post(DECENTRALAND_API_URL, {
            ids: [address],
        });

        const avatarData = profileResponse.data[0]?.avatars[0];
        if (!avatarData) {
            return res.status(404).json({ message: 'Avatar not found for this address' });
        }

        const avatarImageUrl = avatarData.avatar.snapshots.face256;

        // Fetch the image from the Decentraland avatar URL (as binary data)
        const imageResponse = await axios.get(avatarImageUrl, { responseType: 'arraybuffer' });

        // Optional: If you need to convert the image to PNG (if it's not already in PNG format)
        const pngBuffer = await sharp(imageResponse.data).png().toBuffer();

        // Cache the binary data for future use
        cache.set(address, pngBuffer);

        // Return the image as a response with correct headers
        res.setHeader('Content-Type', 'image/png');
        return res.send(pngBuffer);
    } catch (error) {
        console.error('Error fetching avatar image:', error);
        return res.status(500).json({ message: 'Error fetching avatar image', error: error.message });
    }
});

router.get('/quota', verifyToken, async (req: Request, res: Response) => {
    try {
        res.json(await getUserQuota(req.user.id));
    } catch (error) {
        res.status(500).json({ message: 'Error fetching quota information', error: error.message });
    }
});

// Public profile (display name, handle and avatar). Every field is optional and
// a missing key leaves the stored value untouched; null or "" clears it.
router.put('/profile', verifyToken, async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const { displayName, avatarUrl, handle } = req.body ?? {};
    const data: { displayName?: string | null; avatarUrl?: string | null; handle?: string | null } = {};

    try {
        if (handle !== undefined) {
            const checked = validateHandle(handle);
            if (!checked.ok) {
                return res.status(400).json({
                    message: HANDLE_ERRORS[checked.code],
                    code: checked.code,
                });
            }
            data.handle = checked.value;
        }

        if (displayName !== undefined) {
            const checked = validateDisplayName(displayName);
            if (!checked.ok) {
                return res.status(400).json({
                    message: DISPLAY_NAME_ERRORS[checked.code],
                    code: checked.code,
                });
            }
            data.displayName = checked.value;
        }

        if (avatarUrl !== undefined) {
            if (avatarUrl === null || String(avatarUrl).trim() === '') {
                data.avatarUrl = null;
            } else {
                const sha256Hash = avatarUrlHash(avatarUrl);
                if (!sha256Hash) {
                    return res.status(400).json({
                        message: 'The avatar must be an image uploaded through this site.',
                        code: 'AVATAR_URL_INVALID',
                    });
                }
                // The image has to be one of this user's own uploads, and it has
                // to have survived the scanning pipeline.
                const upload = await prisma.fileUpload.findUnique({
                    where: { sha256Hash },
                    select: { userId: true, banned: true, dangerous: true, fileName: true },
                });
                if (!upload || upload.userId !== userId) {
                    return res.status(404).json({
                        message: 'That image was not found among your uploads.',
                        code: 'AVATAR_NOT_FOUND',
                    });
                }
                if (upload.banned || upload.dangerous) {
                    return res.status(400).json({
                        message: 'That image was rejected by the content scan and cannot be used as an avatar.',
                        code: 'AVATAR_BANNED',
                    });
                }
                data.avatarUrl = `${AVATAR_URL_PREFIX}${upload.fileName}`;
            }
        }

        if (Object.keys(data).length === 0) {
            return res.status(400).json({ message: 'Nothing to update.', code: 'NO_CHANGES' });
        }

        const user = await prisma.user.update({
            where: { id: userId },
            data,
            select: { id: true, displayName: true, avatarUrl: true, handle: true },
        });

        return res.json(user);
    } catch (error) {
        // P2002 is Prisma's unique-constraint violation: somebody already has
        // this handle. Nothing was written.
        if ((error as any)?.code === 'P2002') {
            return res.status(409).json({
                message: 'That handle is already taken.',
                code: 'HANDLE_TAKEN',
            });
        }
        console.error('Error updating profile:', error);
        return res.status(500).json({ message: 'Error updating profile', error: (error as any).message });
    }
});

/**
 * GET /api/user/members?q=
 * The member directory, and the same list the article form searches when you
 * credit somebody.
 *
 * Only members who set a handle are listed: the handle is the address of their
 * public page, so having one is how somebody opts into being listed at all.
 * Matching is on handle and display name -- the only things a member chose to
 * publish. The email is never searched, never returned, and internal account
 * ids stay out of this response.
 */
router.get('/members', async (req: Request, res: Response) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const limit = Math.min(Number(req.query.limit) || 60, 100);

    interface MemberRow {
        id: number;
        handle: string | null;
        displayName: string | null;
        avatarUrl: string | null;
        createdAt: Date;
        discordLink: { globalName: string | null; username: string } | null;
        defaultName: { name: string; wallet: { address: string } | null } | null;
    }

    try {
        const members: MemberRow[] = await prisma.user.findMany({
            where: {
                // No handle required. A handle is an alias somebody picked for a
                // nicer URL, not what makes them a member: the account id is the
                // identity, and the name shown is resolved on read.
                //
                // An unverified signup is not a member yet. Without this, anyone
                // who types an email into the form lands on the public page.
                verified: true,
                ...(q !== '' ? {
                    OR: [
                        { handle: { contains: q, mode: 'insensitive' as const } },
                        { displayName: { contains: q, mode: 'insensitive' as const } },
                    ],
                } : {}),
            },
            select: {
                id: true,
                handle: true,
                displayName: true,
                avatarUrl: true,
                createdAt: true,
                discordLink: { select: { globalName: true, username: true } },
                defaultName: { select: { name: true, wallet: { select: { address: true } } } },
            },
            take: limit,
        });

        const ids = members.map((member) => member.id);

        // Counted the same way the member page splits its two sections:
        // projects are what you are a member of, posts are what you wrote.
        const [projectRows, postRows] = ids.length > 0 ? await Promise.all([
            prisma.projectMember.groupBy({
                by: ['userId'],
                where: {
                    userId: { in: ids },
                    project: { published: true },
                },
                _count: { _all: true },
            }),
            prisma.article.groupBy({
                by: ['userId'],
                where: {
                    userId: { in: ids },
                    published: true,
                    NOT: { category: { name: { equals: PORTFOLIO_CATEGORY, mode: 'insensitive' } } },
                },
                _count: { _all: true },
            }),
        ]) : [[], []];

        const projectsBy = new Map<number, number>();
        for (const row of projectRows as { userId: number | null; _count: { _all: number } }[]) {
            if (row.userId !== null) projectsBy.set(row.userId, row._count._all);
        }
        const postsBy = new Map<number, number>();
        for (const row of postRows as { userId: number | null; _count: { _all: number } }[]) {
            if (row.userId !== null) postsBy.set(row.userId, row._count._all);
        }

        const listed = members
            .map((member) => ({
                id: member.id,
                handle: member.handle,
                displayName: resolvePublicName(member),
                avatarUrl: member.avatarUrl,
                memberSince: member.createdAt,
                walletName: member.defaultName?.name ?? null,
                walletAddress: member.defaultName?.wallet?.address ?? null,
                projects: projectsBy.get(member.id) ?? 0,
                posts: postsBy.get(member.id) ?? 0,
            }))
            // An account with no name of its own and nothing published has
            // nothing to show here, so it would list as a bare "member-12".
            // Its page still exists and it appears as soon as either arrives.
            //
            // The test is the resolved name: falling all the way through to
            // member-<id> means nothing identifies this person yet -- no typed
            // name, no Discord, no on-chain name and no handle of their own.
            .filter((member) => !(
                member.displayName === autoHandle(member.id)
                && member.projects === 0
                && member.posts === 0
            ))
            // Whoever has shipped the most goes first; the name only breaks ties.
            .sort((a, b) =>
                (b.projects - a.projects)
                || (b.posts - a.posts)
                || a.displayName.localeCompare(b.displayName));

        res.status(200).json(listed);
    } catch (error: any) {
        res.status(500).json({ message: 'Error listing members', error: error.message });
    }
});

/**
 * GET /api/user/members/:handle
 * Public member page: who they are, where to find them, and what they have
 * worked on. Only fields the member chose to publish; the email is never part
 * of this response.
 */
router.get('/members/:idOrHandle', async (req: Request, res: Response) => {
    // Two ways in, on purpose. The id is the permanent address of a member and
    // always works; the handle is an alias they chose for a readable URL and can
    // change or be cleared. A handle must contain a letter, so the two can never
    // be confused. Articles already answer to a slug or an id this same way.
    const asked = req.params.idOrHandle;
    let where: { id: number } | { handle: string };

    if (/^\d+$/.test(asked)) {
        where = { id: Number(asked) };
    } else {
        const handle = validateHandle(asked);
        if (!handle.ok || !handle.value) {
            return res.status(404).json({ message: 'Member not found' });
        }
        where = { handle: handle.value };
    }

    try {
        const member = await prisma.user.findUnique({
            where,
            select: {
                id: true,
                handle: true,
                displayName: true,
                avatarUrl: true,
                createdAt: true,
                socials: { select: { network: true, handle: true } },
                discordLink: { select: { globalName: true, username: true } },
                defaultName: { select: { name: true, wallet: { select: { address: true } } } },
            },
        });

        if (!member) {
            return res.status(404).json({ message: 'Member not found' });
        }

        // Every project they are a member of, plus what they wrote themselves.
        //
        // The two come from different tables now, and that is the point: a
        // project has no author to be, only members, while a post is written by
        // whoever wrote it.
        const [projects, authored] = await Promise.all([
            prisma.project.findMany({
                where: { published: true, members: { some: { userId: member.id } } },
                select: {
                    id: true, title: true, slug: true, lang: true, thumbnail: true,
                    createdAt: true, featured: true,
                    tags: { select: { id: true, name: true } },
                },
                orderBy: [{ featured: 'desc' }, { startedAt: 'desc' }, { createdAt: 'desc' }],
            }),
            prisma.article.findMany({
                where: {
                    published: true,
                    userId: member.id,
                    NOT: { category: { name: { equals: PORTFOLIO_CATEGORY, mode: 'insensitive' } } },
                },
                select: WORK_SELECT,
                orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
            }),
        ]);

        // Show each work in the language the page is being read in, when a
        // translation exists; otherwise in the language it was written.
        const wanted = typeof req.query.lang === 'string' ? req.query.lang.toLowerCase() : null;
        const inReadersLanguage = (work: typeof authored[number]) => {
            const translation = wanted && work.lang !== wanted
                ? work.translations.find((t) => t.targetLang.toLowerCase() === wanted)
                : null;
            const { translations, ...rest } = work;
            return translation
                ? { ...rest, title: translation.title, slug: translation.slug }
                : rest;
        };

        // `kind` is how the card knows where to link: a project lives at
        // /portfolio/<slug> and a post at /view-article/<slug>. A project's
        // title is never translated and its slug does not change with the
        // language, so it needs none of the swapping above.
        const works = [
            ...projects.map((project) => ({
                kind: 'project' as const,
                id: project.id,
                title: project.title,
                slug: project.slug,
                thumbnail: project.thumbnail,
                createdAt: project.createdAt,
                tags: project.tags,
                category: PORTFOLIO_CATEGORY,
            })),
            ...authored.map(inReadersLanguage).map((work) => ({
                kind: 'post' as const,
                id: work.id,
                title: work.title,
                slug: work.slug,
                thumbnail: work.thumbnail,
                createdAt: work.createdAt,
                tags: work.tags,
                category: work.category?.name ?? null,
            })),
        ];

        return res.json({
            // The id is what the page should build its own links from: it is the
            // address that never moves.
            id: member.id,
            handle: member.handle,
            displayName: resolvePublicName(member),
            avatarUrl: member.avatarUrl,
            memberSince: member.createdAt,
            walletName: member.defaultName?.name ?? null,
            walletAddress: member.defaultName?.wallet?.address ?? null,
            socials: member.socials,
            works,
        });
    } catch (error) {
        console.error('Error fetching member profile:', error);
        return res.status(500).json({ message: 'Error fetching member profile', error: (error as any).message });
    }
});

router.post('/set-default-name', verifyToken, async (req: Request, res: Response) => {
    const { nameId } = req.body;
    const userId = req.user.id;

    try {
        // Check if the nameId is valid and belongs to the user's wallet
        const name = await prisma.walletNames.findFirst({
            where: {
                id: nameId,
                wallet: {
                    userId: userId,
                },
            },
        });

        if (!name) {
            return res.status(404).json({ message: 'Name not found or does not belong to the user.' });
        }

        // Update user's defaultNameId
        await prisma.user.update({
            where: { id: userId },
            data: {
                defaultNameId: nameId,
            },
        });

        return res.json({ message: 'Default name updated successfully.' });
    } catch (error) {
        console.error('Error setting default name:', error);
        return res.status(500).json({ message: 'Error setting default name', error: error.message });
    }
});

router.post('/fetch-avatar', verifyToken, async (req: Request, res: Response) => {
    const { walletAddress } = req.body;

    try {
        const response = await axios.post('https://peer.decentraland.org/lambdas/profiles', {
            ids: [walletAddress],
        });

        if (response.data && response.data.length > 0) {
            const avatar = response.data[0]?.avatars[0];
            const avatarImageUrl = avatar.snapshots.face256;
            return res.json({ avatarImageUrl, name: avatar.name });
        } else {
            return res.status(404).json({ message: 'Avatar not found for this address' });
        }
    } catch (error) {
        console.error('Error fetching avatar:', error);
        return res.status(500).json({ message: 'Error fetching avatar', error: error.message });
    }
});

export async function getUserQuota(userId){
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            maxQuota: true,
            extraQuota: true,
            fileUploads: {
                select: {
                    fileSize: true
                }
            }
        }
    });

    // Calculate total used quota if needed
    const totalUsedQuota = user.fileUploads.reduce((sum, file) => sum + file.fileSize, 0);

    return {
        ...user,
        // DEFAULT_MAX_QUOTA_MB is the floor for everyone; the column only wins
        // when an admin raised it for this account. See services/quota.ts.
        maxQuota: effectiveMaxQuota(user.maxQuota),
        usedQuota: totalUsedQuota,
    }
}

export default router;