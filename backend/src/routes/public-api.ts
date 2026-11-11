/**
 * The public, read-only API: /api/public/v1.
 *
 * Everything it answers is already published on the portfolio, so it asks for
 * no key and answers any origin. It only ever reads, and it only reads
 * published projects -- a draft is not a thing a stranger gets to learn exists.
 *
 * The `v1` in the path is a promise: fields may be added, never removed or
 * renamed. When that stops being possible there will be a v2 and v1 will keep
 * answering, because something out there will still be asking for it.
 */

import express, { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { prisma } from '../db/index.js';
import {
    PUBLIC_PROJECT_SELECT,
    ProjectRow,
    publicProject,
} from '../services/public-projects.js';
import { SITE_URL } from '../config/site.js';

const router = express.Router();

/** Pages are 20 projects unless asked otherwise, and never more than this. */
export const PAGE_DEFAULT = 20;
export const PAGE_MAX = 100;

/**
 * Nobody signs in here, so the only thing between the portfolio and somebody
 * fetching it in a loop is this. Generous enough that a real reader never meets
 * it: a page of a site showing our projects makes one or two calls.
 */
const publicLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Try again in a minute.' },
});

/**
 * How much of the list to send. Anything unreadable falls back to the default
 * rather than refusing: a caller who writes `limit=all` wants projects, not a
 * lecture, and the cap is what actually protects the database.
 */
export function readPaging(query: { limit?: unknown; offset?: unknown }): { limit: number; offset: number } {
    const asNumber = (value: unknown, fallback: number) => {
        const parsed = Number.parseInt(String(value ?? ''), 10);
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
    };
    return {
        limit: Math.min(asNumber(query.limit, PAGE_DEFAULT) || PAGE_DEFAULT, PAGE_MAX),
        offset: asNumber(query.offset, 0),
    };
}

const text = (value: unknown): string | null => {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    return trimmed === '' ? null : trimmed;
};

router.use(publicLimiter);

/** GET /api/public/v1 — what this API answers, so it can be read without docs. */
router.get('/v1', (_req: Request, res: Response) => {
    res.json({
        name: 'ZEROxWORK public API',
        version: 1,
        docs: `${SITE_URL}/api/public/v1`,
        endpoints: [
            {
                path: '/api/public/v1/projects',
                description: 'Published portfolio projects, featured first, newest first.',
                query: {
                    lang: 'Language for the prose (es, en, fr, pt-br, zh). Falls back to how it was written.',
                    tag: 'Only projects carrying this tag.',
                    author: 'Only projects this member handle worked on.',
                    limit: `How many to return. Default ${PAGE_DEFAULT}, maximum ${PAGE_MAX}.`,
                    offset: 'How many to skip, for paging.',
                },
            },
            {
                path: '/api/public/v1/projects/{idOrSlug}',
                description: 'One project, including its body text in Markdown.',
                query: { lang: 'Same as above.' },
            },
        ],
        notes: [
            'Read only. No key needed. Any origin may call it from a browser.',
            'Image and member addresses are absolute, ready to use anywhere.',
            'Fields may be added to v1; none will be removed or renamed.',
        ],
    });
});

/** GET /api/public/v1/projects — the portfolio. */
router.get('/v1/projects', async (req: Request, res: Response) => {
    const lang = text(req.query.lang);
    const tag = text(req.query.tag);
    const author = text(req.query.author);
    const { limit, offset } = readPaging(req.query);

    const where = {
        published: true,
        ...(tag ? { tags: { some: { name: { equals: tag, mode: 'insensitive' as const } } } } : {}),
        ...(author ? { members: { some: { user: { handle: author.toLowerCase() } } } } : {}),
    };

    try {
        // Counted separately so a caller paging through knows when to stop
        // without having to ask for everything first.
        const [total, projects] = await Promise.all([
            prisma.project.count({ where }),
            prisma.project.findMany({
                where,
                select: PUBLIC_PROJECT_SELECT,
                orderBy: [{ featured: 'desc' }, { startedAt: 'desc' }, { createdAt: 'desc' }],
                take: limit,
                skip: offset,
            }),
        ]);

        res.json({
            total,
            limit,
            offset,
            items: projects.map((project) =>
                publicProject(project as unknown as ProjectRow, lang, { content: false })),
        });
    } catch (error: any) {
        console.error('Public API: listing projects failed', error);
        res.status(500).json({ error: 'Could not list the projects.' });
    }
});

/** GET /api/public/v1/projects/:idOrSlug — one project, body text included. */
router.get('/v1/projects/:idOrSlug', async (req: Request, res: Response) => {
    const asked = req.params.idOrSlug;
    const lang = text(req.query.lang);

    try {
        const project = await prisma.project.findUnique({
            where: /^\d+$/.test(asked) ? { id: Number(asked) } : { slug: asked.toLowerCase() },
            select: { ...PUBLIC_PROJECT_SELECT, published: true },
        });

        // A draft answers 404 like anything else that is not there: whether it
        // exists at all is not something a stranger needs to learn.
        if (!project || !project.published) {
            return res.status(404).json({ error: 'No such project.' });
        }

        const { published, ...row } = project;
        res.json(publicProject(row as unknown as ProjectRow, lang, { content: true }));
    } catch (error: any) {
        console.error('Public API: loading project failed', asked, error);
        res.status(500).json({ error: 'Could not load the project.' });
    }
});

/** Anything else under /api/public answers in JSON, not in an HTML page. */
router.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'No such endpoint. See /api/public/v1.' });
});

export default router;
