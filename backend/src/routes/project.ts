import express, { Request, Response } from 'express';
import { prisma } from '../db/index.js';
import { optionalAuth } from '../middleware/optionalAuth.js';
import { verifyToken } from '../middleware/authMiddleware.js';
import { resolvePublicName } from '../config/public-name.js';
import { ROLE } from '../constants/roles.js';
import { slugify, computeSourceHash } from '../utils/slug.js';
import { normaliseCredits, CreditError } from '../services/article-credits.js';
import { updateProjectTranslations, dropProjectTranslations } from '../services/project-translation.js';
import { notifyAdminNewProject } from '../services/admin-notify.js';
import { SUPPORTED_LANGS } from '../services/deepl.js';
import {
    validateCover,
    normaliseScreenshots,
    validateVideoUrl,
    MEDIA_ERRORS,
} from '../config/project-media.js';
import {
    validateTitle,
    validateContent,
    validateSummary,
    validateStatus,
    validateSiteUrl,
    validateRepoUrl,
    validateDates,
    slugWithLetter,
    FIELD_ERRORS,
    FieldErrorCode,
} from '../config/project-fields.js';

const router = express.Router();

/**
 * Portfolio items. A project is not an article: it has no author, it has
 * members, and its address is /portfolio/<slug> with /portfolio/<id> always
 * working behind it -- the same rule as a member page.
 *
 * There is one address per project, not one per language: the title is never
 * translated, so the reader's language picks which stored translation fills the
 * page rather than sending them to a different URL.
 *
 * Any member may enter a project, and nothing they enter is published by
 * anyone's hand but their own: a new project is a draft until they say
 * otherwise, exactly like an article.
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
function inLanguage(project: Listed, lang: string | null, viewer?: any) {
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
        // Whether the page should offer to edit and publish. Sent instead of
        // createdById so the frontend never has to know who owns what.
        canEdit: viewer ? mayWrite(viewer, project) : false,
    };
}

/** Editing and publishing stay with whoever entered the project, plus admins. */
const mayWrite = (req: any, project: { createdById: number | null }) =>
    Boolean(req?.user) && (req.user.role === ROLE.ADMIN || req.user.id === project.createdById);

/** The two error registries answer with the same shape, so refusals read alike. */
const refuse = (res: Response, code: string, message: string) =>
    res.status(400).json({ error: message, code });

const refuseField = (res: Response, code: FieldErrorCode) => refuse(res, code, FIELD_ERRORS[code]);

/**
 * A free slug for a project. Projects keep no slug history -- a portfolio item
 * changes its name once in a blue moon and /portfolio/<id> never stops working
 * -- so this only has to avoid the slugs in use right now.
 */
async function makeUniqueProjectSlug(base: string, exceptId?: number): Promise<string> {
    const wanted = slugWithLetter(base || 'project');
    let slug = wanted;
    let counter = 1;

    while (true) {
        const taken = await prisma.project.findUnique({ where: { slug }, select: { id: true } });
        if (!taken || taken.id === exceptId) return slug;
        counter++;
        slug = `${wanted}-${counter}`;
    }
}

/** Tag ids for this save, creating the ones typed by hand. */
async function resolveTagIds(tagIds: unknown, newTags: unknown): Promise<number[]> {
    const existing = Array.isArray(tagIds)
        ? tagIds.map((id) => Number(id)).filter(Number.isInteger)
        : [];

    const created: number[] = [];
    if (Array.isArray(newTags)) {
        for (const raw of newTags) {
            const name = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
            if (name === '') continue;
            try {
                const tag = await prisma.tag.create({ data: { name } });
                created.push(tag.id);
            } catch (error: any) {
                // Already there: use it rather than failing the save.
                if (error.code !== 'P2002') throw error;
                const found = await prisma.tag.findUnique({ where: { name }, select: { id: true } });
                if (found) created.push(found.id);
            }
        }
    }

    return [...new Set([...existing, ...created])];
}

/** Who to name in the owner's notice, resolved the way the site shows names. */
async function publisherName(userId: number): Promise<string> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true, handle: true, displayName: true,
            discordLink: { select: { globalName: true, username: true } },
            defaultName: { select: { name: true } },
        },
    });
    return user ? resolvePublicName(user) : `member-${userId}`;
}

/** One of the five languages the site speaks. */
const isSupportedLang = (lang: string) =>
    (SUPPORTED_LANGS as readonly string[]).includes(lang.toUpperCase());

/**
 * Everything a project save has in common, validated before anything is
 * written so a half-valid project never reaches the database. `creating` is
 * what demands the gallery: a project is asked to show itself when it is
 * entered, and not again -- the projects that came over from the blog have no
 * screenshots, and an edit is how they get some.
 */
function validateBody(body: any, { creating }: { creating: boolean }) {
    const title = validateTitle(body.title);
    if (!title.ok) return title;

    const content = validateContent(body.content);
    if (!content.ok) return content;

    const summary = validateSummary(body.summary);
    if (!summary.ok) return summary;

    const status = validateStatus(body.status);
    if (!status.ok) return status;

    const siteUrl = validateSiteUrl(body.siteUrl);
    if (!siteUrl.ok) return siteUrl;

    const repoUrl = validateRepoUrl(body.repoUrl);
    if (!repoUrl.ok) return repoUrl;

    const dates = validateDates(body.startedAt, body.endedAt);
    if (!dates.ok) return dates;

    const cover = validateCover(body.thumbnail, creating);
    if (!cover.ok) return { ok: false as const, media: cover.code };

    const screenshots = normaliseScreenshots(body.screenshots, creating);
    if (!screenshots.ok) return { ok: false as const, media: screenshots.code };

    const videoUrl = validateVideoUrl(body.videoUrl);
    if (!videoUrl.ok) return { ok: false as const, media: videoUrl.code };

    return {
        ok: true as const,
        value: {
            title: title.value,
            content: content.value,
            summary: summary.value,
            status: status.value,
            siteUrl: siteUrl.value,
            repoUrl: repoUrl.value,
            startedAt: dates.value.startedAt,
            endedAt: dates.value.endedAt,
            thumbnail: cover.value,
            screenshots: screenshots.value,
            videoUrl: videoUrl.value,
        },
    };
}

/** Turns whatever validateBody refused into the right 400. */
function refuseBody(res: Response, bad: { code?: FieldErrorCode; media?: keyof typeof MEDIA_ERRORS }) {
    if (bad.media) return refuse(res, bad.media, MEDIA_ERRORS[bad.media]);
    return refuseField(res, bad.code as FieldErrorCode);
}

// ==================== READING ====================

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

/**
 * GET /api/projects/mine — what the caller has entered, drafts included.
 *
 * Registered before /:idOrSlug, or "mine" would be read as a slug. Only
 * projects they can actually edit: being credited on somebody else's project
 * shows up on your member page, not in your drafts.
 */
router.get('/mine', verifyToken, async (req: any, res: Response) => {
    try {
        const projects = await prisma.project.findMany({
            where: { createdById: req.user.id },
            select: {
                id: true, slug: true, title: true, thumbnail: true, published: true,
                createdAt: true, updatedAt: true,
                _count: { select: { members: true } },
            },
            orderBy: [{ updatedAt: 'desc' }],
        });

        res.json(projects.map(({ _count, ...project }) => ({ ...project, members: _count.members })));
    } catch (error: any) {
        res.status(500).json({ message: 'Error listing your projects', error: error.message });
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

        res.json(inLanguage(project, lang, req));
    } catch (error: any) {
        res.status(500).json({ message: 'Error loading project', error: error.message });
    }
});

// ==================== WRITING ====================

/**
 * POST /api/projects — enter a project. Any member may; it is a draft until
 * they publish it, and it needs at least one member, because a portfolio item
 * with nobody on it says nothing about who we are.
 */
router.post('/', verifyToken, async (req: any, res: Response) => {
    try {
        const checked = validateBody(req.body, { creating: true });
        if (!checked.ok) return refuseBody(res, checked);
        const fields = checked.value;

        const lang = String(req.body.lang ?? 'en').toLowerCase();
        if (!isSupportedLang(lang)) {
            return res.status(400).json({ error: 'That is not a language the site speaks.', code: 'LANG_INVALID' });
        }

        const members = await normaliseCredits(req.body.members);
        if (members.length === 0) return refuseField(res, 'MEMBERS_REQUIRED');

        const slug = await makeUniqueProjectSlug(slugify(req.body.slug || fields.title));
        const tagIds = await resolveTagIds(req.body.tagIds, req.body.newTags);

        const project = await prisma.project.create({
            data: {
                ...fields,
                // A cover is demanded when creating, so it is there; the column
                // is NOT NULL and the type has to be told as much.
                thumbnail: fields.thumbnail as string,
                slug,
                lang,
                sourceHash: computeSourceHash(fields.title, fields.content),
                // Writing is not publishing.
                published: false,
                // Featuring something on the landing page is the owner's call.
                featured: req.user.role === ROLE.ADMIN ? Boolean(req.body.featured) : false,
                createdById: req.user.id,
                tags: tagIds.length > 0 ? { connect: tagIds.map((id) => ({ id })) } : undefined,
                members: { create: members.map((member, position) => ({ ...member, position })) },
            },
            select: LISTED,
        });

        // No translations yet: a draft is still being written, and translating
        // it would spend DeepL characters on text that is about to change.
        res.status(201).json(inLanguage(project, null, req));
    } catch (error: any) {
        if (error instanceof CreditError) return res.status(400).json({ error: error.message });
        res.status(500).json({ message: 'Error creating project', error: error.message });
    }
});

/** PUT /api/projects/:id — edit. Publishing is PATCH, not a field of this. */
router.put('/:id', verifyToken, async (req: any, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid project id' });

    try {
        const existing = await prisma.project.findUnique({
            where: { id },
            select: { id: true, slug: true, lang: true, published: true, sourceHash: true, createdById: true },
        });

        if (!existing || (!existing.published && !mayWrite(req, existing))) {
            return res.status(404).json({ error: 'Project not found' });
        }
        if (!mayWrite(req, existing)) {
            return res.status(403).json({ error: 'Not authorized to edit this project' });
        }

        const checked = validateBody(req.body, { creating: false });
        if (!checked.ok) return refuseBody(res, checked);
        const fields = checked.value;

        const lang = req.body.lang ? String(req.body.lang).toLowerCase() : existing.lang;
        if (!isSupportedLang(lang)) {
            return res.status(400).json({ error: 'That is not a language the site speaks.', code: 'LANG_INVALID' });
        }

        // Only touched when the form sent them, so a client that knows nothing
        // about members cannot empty the list. When it does send them, the rule
        // still holds: a project keeps at least one.
        const membersSent = req.body.members !== undefined;
        const members = membersSent ? await normaliseCredits(req.body.members) : [];
        if (membersSent && members.length === 0) return refuseField(res, 'MEMBERS_REQUIRED');

        const askedSlug = typeof req.body.slug === 'string' ? slugify(req.body.slug) : '';
        const slug = askedSlug !== '' && slugWithLetter(askedSlug) !== existing.slug
            ? await makeUniqueProjectSlug(askedSlug, existing.id)
            : existing.slug;

        const tagIds = await resolveTagIds(req.body.tagIds, req.body.newTags);
        const sourceHash = computeSourceHash(fields.title, fields.content);
        const contentChanged = sourceHash !== existing.sourceHash;
        const langChanged = lang !== existing.lang;

        // The stored copies were made from a different original, so they are
        // worse than nothing: they read as if the prose had never changed.
        if (langChanged) await dropProjectTranslations(existing.id);

        const project = await prisma.project.update({
            where: { id: existing.id },
            data: {
                ...fields,
                // An edit may leave the cover alone; the column cannot be null,
                // so an empty one means "keep what is there".
                thumbnail: fields.thumbnail ?? undefined,
                slug,
                lang,
                sourceHash,
                featured: req.user.role === ROLE.ADMIN && req.body.featured !== undefined
                    ? Boolean(req.body.featured)
                    : undefined,
                tags: { set: tagIds.map((tagId) => ({ id: tagId })) },
                members: membersSent
                    ? {
                        deleteMany: {},
                        create: members.map((member, position) => ({ ...member, position })),
                    }
                    : undefined,
            },
            select: LISTED,
        });

        // Only what is live gets translated, and the moment it is live it gets
        // its copies even if this save did not touch the text.
        if (project.published && (contentChanged || langChanged)) {
            updateProjectTranslations(project.id, project.title, project.summary, project.content, project.lang, sourceHash)
                .catch((error: any) => console.error('Project translation error:', error));
        }

        res.json(inLanguage(project, null, req));
    } catch (error: any) {
        if (error instanceof CreditError) return res.status(400).json({ error: error.message });
        res.status(500).json({ message: 'Error updating project', error: error.message });
    }
});

/**
 * PATCH /api/projects/:id/published — the only way a project goes live.
 *
 * Its own endpoint, not a field on PUT: publishing from a list would otherwise
 * have to resend the whole project and would wipe whatever the list does not
 * carry.
 */
router.patch('/:id/published', verifyToken, async (req: any, res: Response) => {
    const id = Number(req.params.id);
    const { published } = req.body ?? {};

    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid project id' });
    if (typeof published !== 'boolean') {
        return res.status(400).json({ error: 'published must be true or false' });
    }

    try {
        const project = await prisma.project.findUnique({
            where: { id },
            select: {
                id: true, slug: true, title: true, summary: true, content: true, lang: true,
                thumbnail: true, screenshots: true, published: true, createdById: true,
                sourceHash: true,
                _count: { select: { members: true } },
            },
        });

        if (!project || (!project.published && !mayWrite(req, project))) {
            return res.status(404).json({ error: 'Project not found' });
        }
        if (!mayWrite(req, project)) {
            return res.status(403).json({ error: 'Not authorized to publish this project' });
        }

        if (published) {
            // The rule that cannot be bent: a project in the portfolio says who
            // made it. Everything else about the media is only checked for
            // shape -- the gallery is asked for at the alta.
            if (project._count.members === 0) return refuseField(res, 'MEMBERS_REQUIRED');

            const cover = validateCover(project.thumbnail, true);
            if (!cover.ok) return refuse(res, cover.code, MEDIA_ERRORS[cover.code]);

            const shots = normaliseScreenshots(project.screenshots, false);
            if (!shots.ok) return refuse(res, shots.code, MEDIA_ERRORS[shots.code]);
        }

        if (project.published === published) {
            return res.json({ id: project.id, published });
        }

        const updated = await prisma.project.update({
            where: { id: project.id },
            data: { published },
            select: LISTED,
        });

        // Translating and telling the owner both belong to going live.
        if (published) {
            const hash = project.sourceHash ?? computeSourceHash(project.title, project.content);
            updateProjectTranslations(updated.id, updated.title, updated.summary, updated.content, updated.lang, hash)
                .catch((error: any) => console.error('Project translation error on publish:', error));

            // The public name, not the email: the owner wants to know who put
            // it up, and an address in a notice is an address in a mailbox.
            publisherName(req.user.id)
                .then((by) => notifyAdminNewProject({
                    title: updated.title,
                    by,
                    lang: updated.lang,
                    slug: updated.slug,
                }))
                .catch((error: any) => console.error('Admin notify error:', error));
        }

        res.json(inLanguage(updated, null, req));
    } catch (error: any) {
        res.status(500).json({ message: 'Error changing publication state', error: error.message });
    }
});

/**
 * DELETE /api/projects/:id/members/me — step out of a project.
 *
 * Anyone may credit anyone, so anyone must be able to leave. The last member
 * cannot: a project with nobody on it is exactly what the minimum exists to
 * prevent, and whoever entered it should take it down instead.
 */
router.delete('/:id/members/me', verifyToken, async (req: any, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid project id' });

    try {
        const mine = await prisma.projectMember.findFirst({
            where: { projectId: id, userId: req.user.id },
            select: { id: true },
        });
        if (!mine) return res.status(404).json({ error: 'You are not a member of this project' });

        const total = await prisma.projectMember.count({ where: { projectId: id } });
        if (total <= 1) {
            return res.status(409).json({
                error: 'You are the only member of this project; it cannot be left with nobody.',
                code: 'MEMBERS_REQUIRED',
            });
        }

        await prisma.projectMember.delete({ where: { id: mine.id } });
        res.json({ removed: 1 });
    } catch (error: any) {
        res.status(500).json({ message: 'Error leaving project', error: error.message });
    }
});

/** DELETE /api/projects/:id — members and translations go with it. */
router.delete('/:id', verifyToken, async (req: any, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid project id' });

    try {
        const project = await prisma.project.findUnique({
            where: { id },
            select: { id: true, published: true, createdById: true },
        });

        if (!project || (!project.published && !mayWrite(req, project))) {
            return res.status(404).json({ error: 'Project not found' });
        }
        if (!mayWrite(req, project)) {
            return res.status(403).json({ error: 'Not authorized to delete this project' });
        }

        await prisma.project.delete({ where: { id: project.id } });
        res.json({ message: 'Project deleted' });
    } catch (error: any) {
        res.status(500).json({ message: 'Error deleting project', error: error.message });
    }
});

export default router;
