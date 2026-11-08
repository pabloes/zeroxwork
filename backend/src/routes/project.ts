import express, { Request, Response } from 'express';
import { prisma } from '../db/index.js';
import { optionalAuth } from '../middleware/optionalAuth.js';
import { resolvePublicName } from '../config/public-name.js';
import { ROLE } from '../constants/roles.js';

const router = express.Router();

/**
 * Portfolio items. A project is not an article: it has no author, it has
 * members, and its address is /portfolio/<slug> with /portfolio/<id> always
 * working behind it -- the same rule as a member page.
 *
 * There is one address per project, not one per language: the title is never
 * translated, so the reader's language picks which stored translation fills the
 * page rather than sending them to a different URL.
 */

const LISTED = {
    id: true, slug: true, title: true, summary: true, content: true, lang: true,
    thumbnail: true, screenshots: true, videoUrl: true, siteUrl: true, repoUrl: true,
    startedAt: true, endedAt: true, status: true,
    published: true, featured: true, createdAt: true, updatedAt: true, createdById: true,
    tags: { select: { id: true, name: true } },
    members: {
        select: {
            name: true, role: true, position: true, userId: true,
            user: {
                select: {
                    id: true, handle: true, displayName: true, avatarUrl: true,
                    discordLink: { select: { globalName: true, username: true } },
                    defaultName: { select: { name: true } },
                },
            },
        },
        orderBy: { position: 'asc' as const },
    },
    translations: {
        select: { targetLang: true, title: true, summary: true, content: true },
    },
};

type Listed = Awaited<ReturnType<typeof prisma.project.findMany<{ select: typeof LISTED }>>>[number];

/**
 * The same shape a credit has, so the member list renders with the component
 * articles already use. `userId` is what makes the name a link to a member
 * page; a member without an account is a name and nothing else.
 */
function publicMembers(members: Listed['members']) {
    return members.map((member) => ({
        name: member.user ? resolvePublicName(member.user) : member.name,
        role: member.role,
        userId: member.userId,
        handle: member.user?.handle ?? null,
        avatarUrl: member.user?.avatarUrl ?? null,
    }));
}

/** The project as the reader's language has it, falling back to how it was written. */
function inLanguage(project: Listed, lang: string | null) {
    const wanted = (lang ?? '').toLowerCase();
    const translation = wanted && wanted !== project.lang.toLowerCase()
        ? project.translations.find((t) => t.targetLang.toLowerCase() === wanted)
        : null;

    const { translations, createdById, ...rest } = project;

    return {
        ...rest,
        // The title deliberately survives translation: a project is called what
        // it is called. Only the prose changes language.
        title: project.title,
        summary: translation?.summary ?? project.summary,
        content: translation?.content ?? project.content,
        readingLang: translation ? translation.targetLang : project.lang,
        availableLangs: [project.lang, ...project.translations.map((t) => t.targetLang)],
        members: publicMembers(project.members),
    };
}

/** Editing and publishing stay with whoever entered the project, plus admins. */
const mayWrite = (req: any, project: { createdById: number | null }) =>
    Boolean(req.user) && (req.user.role === ROLE.ADMIN || req.user.id === project.createdById);

/** GET /api/projects — the portfolio, newest first, featured on top. */
router.get('/', async (req: Request, res: Response) => {
    const lang = typeof req.query.lang === 'string' ? req.query.lang : null;

    try {
        const projects = await prisma.project.findMany({
            where: { published: true },
            select: LISTED,
            orderBy: [{ featured: 'desc' }, { startedAt: 'desc' }, { createdAt: 'desc' }],
        });

        res.json(projects.map((project) => inLanguage(project, lang)));
    } catch (error: any) {
        res.status(500).json({ message: 'Error listing projects', error: error.message });
    }
});

/** GET /api/projects/:idOrSlug — one project. A draft is visible only to its own. */
router.get('/:idOrSlug', optionalAuth, async (req: any, res: Response) => {
    const asked = req.params.idOrSlug;
    const lang = typeof req.query.lang === 'string' ? req.query.lang : null;

    try {
        const project = await prisma.project.findUnique({
            where: /^\d+$/.test(asked) ? { id: Number(asked) } : { slug: asked.toLowerCase() },
            select: LISTED,
        });

        // A draft answers 404 rather than 403: whether it exists at all is not
        // something a stranger needs to learn.
        if (!project || (!project.published && !mayWrite(req, project))) {
            return res.status(404).json({ message: 'Project not found' });
        }

        res.json(inLanguage(project, lang));
    } catch (error: any) {
        res.status(500).json({ message: 'Error loading project', error: error.message });
    }
});

export default router;
