import crypto from 'crypto';
import express, { Request, Response } from 'express';
import { prisma } from '../db/index.js';
import { optionalAuth } from '../middleware/optionalAuth.js';
import { verifyToken } from '../middleware/authMiddleware.js';
import { ROLE } from '../constants/roles.js';
import { slugify } from '../utils/slug.js';
import { updateToolTranslations, dropToolTranslations } from '../services/tool-translation.js';
import { SUPPORTED_LANGS } from '../services/deepl.js';
import { validateCover, MEDIA_ERRORS } from '../config/project-media.js';
import {
    validateTitle,
    validateSummary,
    validateContent,
    validateMode,
    validateHref,
    validateEmbedHeight,
    slugWithLetter,
    TOOL_ERRORS,
    ToolErrorCode,
} from '../config/tool-fields.js';

const router = express.Router();

/**
 * El catalogo de herramientas.
 *
 * Una herramienta no es un articulo con otra etiqueta: es una ficha. Un nombre,
 * una imagen, una linea y un sitio al que ir. Dos de las tres que vinieron del
 * blog no tenian ni un caracter de texto.
 *
 * Direccion: /tools para la lista, y /tools/<slug> solo para las que se
 * incrustan. Una que salta no necesita pagina propia -- su pagina es el sitio
 * al que lleva -- pero la ficha responde igual por si alguien pide la URL.
 */

const LISTED = {
    id: true, slug: true, title: true, summary: true, content: true, lang: true,
    thumbnail: true, href: true, mode: true, embedHeight: true,
    published: true, featured: true, createdAt: true, updatedAt: true, createdById: true,
    tags: { select: { id: true, name: true } },
    translations: {
        select: { targetLang: true, title: true, summary: true, content: true },
    },
};

type Listed = Awaited<ReturnType<typeof prisma.tool.findMany<{ select: typeof LISTED }>>>[number];

/**
 * La huella del texto, que es lo que decide si hay que volver a traducir.
 *
 * Lleva el resumen dentro a proposito. En proyectos no lo lleva, y eso tiene
 * una consecuencia que se ve: guardar un resumen sin tocar el cuerpo no dispara
 * ninguna traduccion, y el lector en chino se queda con la frase en ingles. En
 * una herramienta el resumen es casi todo el texto que hay, asi que dejarlo
 * fuera seria dejar fuera la traduccion entera.
 */
function toolSourceHash(title: string, summary: string | null, content: string | null): string {
    return crypto
        .createHash('sha1')
        .update([title, summary ?? '', content ?? ''].join('\n'))
        .digest('hex');
}

/** La herramienta en el idioma del lector, con el original como respaldo. */
function inLanguage(tool: Listed, lang: string | null, viewer?: any) {
    const wanted = (lang ?? '').toLowerCase();
    const translation = wanted && wanted !== tool.lang.toLowerCase()
        ? tool.translations.find((t) => t.targetLang.toLowerCase() === wanted)
        : null;

    const { translations, createdById, ...rest } = tool;

    return {
        ...rest,
        // El titulo sobrevive a la traduccion, igual que en un proyecto.
        title: tool.title,
        summary: translation?.summary ?? tool.summary,
        content: translation?.content ?? tool.content,
        readingLang: translation ? translation.targetLang : tool.lang,
        availableLangs: [tool.lang, ...tool.translations.map((t) => t.targetLang)],
        // Si la pagina debe ofrecer editar y publicar. Se manda esto en vez de
        // createdById para que el frontend no tenga que saber de quien es que.
        canEdit: viewer ? mayWrite(viewer, tool) : false,
    };
}

/** Editar y publicar se queda con quien la dio de alta, y con los administradores. */
const mayWrite = (req: any, tool: { createdById: number | null }) =>
    Boolean(req?.user) && (req.user.role === ROLE.ADMIN || req.user.id === tool.createdById);

const refuse = (res: Response, code: string, message: string) =>
    res.status(400).json({ error: message, code });

const refuseField = (res: Response, code: ToolErrorCode) => refuse(res, code, TOOL_ERRORS[code]);

/** Un slug libre. No hay historial: /tools/<id> nunca deja de funcionar. */
async function makeUniqueToolSlug(base: string, exceptId?: number): Promise<string> {
    const wanted = slugWithLetter(base || 'tool');
    let slug = wanted;
    let counter = 1;

    while (true) {
        const taken = await prisma.tool.findUnique({ where: { slug }, select: { id: true } });
        if (!taken || taken.id === exceptId) return slug;
        counter++;
        slug = `${wanted}-${counter}`;
    }
}

/** Las etiquetas de este guardado, creando las que se hayan escrito a mano. */
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
                // Ya estaba: usarla en vez de reventar el guardado.
                if (error.code !== 'P2002') throw error;
                const found = await prisma.tag.findUnique({ where: { name }, select: { id: true } });
                if (found) created.push(found.id);
            }
        }
    }

    return [...new Set([...existing, ...created])];
}

/** Uno de los cinco idiomas que habla el sitio. */
const isSupportedLang = (lang: string) =>
    (SUPPORTED_LANGS as readonly string[]).includes(lang.toUpperCase());

/**
 * Todo lo que un guardado tiene en comun, comprobado antes de escribir nada.
 *
 * El modo se valida primero porque los dos campos siguientes dependen de el:
 * una direccion vale o no segun si va a abrirse o a incrustarse, y el alto solo
 * significa algo cuando se incrusta.
 */
function validateBody(body: any) {
    const mode = validateMode(body.mode);
    if (!mode.ok) return mode;

    const title = validateTitle(body.title);
    if (!title.ok) return title;

    const summary = validateSummary(body.summary);
    if (!summary.ok) return summary;

    const content = validateContent(body.content);
    if (!content.ok) return content;

    const href = validateHref(body.href, mode.value);
    if (!href.ok) return href;

    const embedHeight = validateEmbedHeight(body.embedHeight, mode.value);
    if (!embedHeight.ok) return embedHeight;

    // La portada es opcional: una herramienta sin imagen sigue siendo una
    // herramienta, y la tarjeta ya sabe dibujar el hueco.
    const cover = validateCover(body.thumbnail, false);
    if (!cover.ok) return { ok: false as const, media: cover.code };

    return {
        ok: true as const,
        value: {
            title: title.value,
            summary: summary.value,
            content: content.value,
            href: href.value,
            mode: mode.value,
            embedHeight: embedHeight.value,
            thumbnail: cover.value,
        },
    };
}

function refuseBody(res: Response, bad: { code?: ToolErrorCode; media?: keyof typeof MEDIA_ERRORS }) {
    if (bad.media) return refuse(res, bad.media, MEDIA_ERRORS[bad.media]);
    return refuseField(res, bad.code as ToolErrorCode);
}

// ==================== LEER ====================

/** GET /api/tools — el catalogo, las destacadas primero. */
router.get('/', async (req: Request, res: Response) => {
    const lang = typeof req.query.lang === 'string' ? req.query.lang : null;

    try {
        const tools = await prisma.tool.findMany({
            where: { published: true },
            select: LISTED,
            orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
        });

        res.json(tools.map((tool) => inLanguage(tool, lang)));
    } catch (error: any) {
        res.status(500).json({ message: 'Error listing tools', error: error.message });
    }
});

/**
 * GET /api/tools/mine — las que ha dado de alta quien llama, borradores
 * incluidos. Va antes de /:idOrSlug, o "mine" se leeria como un slug.
 */
router.get('/mine', verifyToken, async (req: any, res: Response) => {
    try {
        const tools = await prisma.tool.findMany({
            where: { createdById: req.user.id },
            select: {
                id: true, slug: true, title: true, thumbnail: true, mode: true,
                href: true, published: true, createdAt: true, updatedAt: true,
            },
            orderBy: [{ updatedAt: 'desc' }],
        });

        res.json(tools);
    } catch (error: any) {
        res.status(500).json({ message: 'Error listing your tools', error: error.message });
    }
});

/** GET /api/tools/:idOrSlug — una ficha. Un borrador solo lo ve el suyo. */
router.get('/:idOrSlug', optionalAuth, async (req: any, res: Response) => {
    const asked = req.params.idOrSlug;
    const lang = typeof req.query.lang === 'string' ? req.query.lang : null;

    try {
        const tool = await prisma.tool.findUnique({
            where: /^\d+$/.test(asked) ? { id: Number(asked) } : { slug: asked.toLowerCase() },
            select: LISTED,
        });

        // Un borrador responde 404 y no 403: que exista no es algo que un
        // desconocido tenga que llegar a saber.
        if (!tool || (!tool.published && !mayWrite(req, tool))) {
            return res.status(404).json({ message: 'Tool not found' });
        }

        res.json(inLanguage(tool, lang, req));
    } catch (error: any) {
        res.status(500).json({ message: 'Error loading tool', error: error.message });
    }
});

// ==================== ESCRIBIR ====================

/**
 * POST /api/tools — dar de alta una herramienta. Nace borrador, como todo lo
 * demas: lo que se publica lo publica su autor y nadie mas.
 */
router.post('/', verifyToken, async (req: any, res: Response) => {
    try {
        const checked = validateBody(req.body);
        if (!checked.ok) return refuseBody(res, checked);
        const fields = checked.value;

        const lang = String(req.body.lang ?? 'en').toLowerCase();
        if (!isSupportedLang(lang)) {
            return res.status(400).json({ error: 'That is not a language the site speaks.', code: 'LANG_INVALID' });
        }

        const slug = await makeUniqueToolSlug(slugify(req.body.slug || fields.title));
        const tagIds = await resolveTagIds(req.body.tagIds, req.body.newTags);

        const tool = await prisma.tool.create({
            data: {
                ...fields,
                slug,
                lang,
                sourceHash: toolSourceHash(fields.title, fields.summary, fields.content),
                published: false,
                featured: req.user.role === ROLE.ADMIN ? Boolean(req.body.featured) : false,
                createdById: req.user.id,
                tags: tagIds.length > 0 ? { connect: tagIds.map((id) => ({ id })) } : undefined,
            },
            select: LISTED,
        });

        // Sin traducir todavia: un borrador se esta escribiendo, y traducirlo
        // seria gastar caracteres de DeepL en un texto que va a cambiar.
        res.status(201).json(inLanguage(tool, null, req));
    } catch (error: any) {
        res.status(500).json({ message: 'Error creating tool', error: error.message });
    }
});

/** PUT /api/tools/:id — editar. Publicar es el PATCH, no un campo de esto. */
router.put('/:id', verifyToken, async (req: any, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid tool id' });

    try {
        const existing = await prisma.tool.findUnique({
            where: { id },
            select: { id: true, slug: true, lang: true, published: true, sourceHash: true, createdById: true },
        });

        if (!existing || (!existing.published && !mayWrite(req, existing))) {
            return res.status(404).json({ error: 'Tool not found' });
        }
        if (!mayWrite(req, existing)) {
            return res.status(403).json({ error: 'Not authorized to edit this tool' });
        }

        const checked = validateBody(req.body);
        if (!checked.ok) return refuseBody(res, checked);
        const fields = checked.value;

        const lang = req.body.lang ? String(req.body.lang).toLowerCase() : existing.lang;
        if (!isSupportedLang(lang)) {
            return res.status(400).json({ error: 'That is not a language the site speaks.', code: 'LANG_INVALID' });
        }

        const askedSlug = typeof req.body.slug === 'string' ? slugify(req.body.slug) : '';
        const slug = askedSlug !== '' && slugWithLetter(askedSlug) !== existing.slug
            ? await makeUniqueToolSlug(askedSlug, existing.id)
            : existing.slug;

        const tagIds = await resolveTagIds(req.body.tagIds, req.body.newTags);
        const sourceHash = toolSourceHash(fields.title, fields.summary, fields.content);
        const textChanged = sourceHash !== existing.sourceHash;
        const langChanged = lang !== existing.lang;

        // Las copias guardadas se hicieron desde otro original, asi que valen
        // menos que nada: se leen como si el texto nunca hubiera cambiado.
        if (langChanged) await dropToolTranslations(existing.id);

        const tool = await prisma.tool.update({
            where: { id: existing.id },
            data: {
                ...fields,
                slug,
                lang,
                sourceHash,
                featured: req.user.role === ROLE.ADMIN && req.body.featured !== undefined
                    ? Boolean(req.body.featured)
                    : undefined,
                tags: { set: tagIds.map((tagId) => ({ id: tagId })) },
            },
            select: LISTED,
        });

        // Solo se traduce lo que esta vivo, y en cuanto lo esta recibe sus
        // copias aunque este guardado no haya tocado el texto.
        if (tool.published && (textChanged || langChanged)) {
            updateToolTranslations(tool.id, tool.title, tool.summary, tool.content, tool.lang, sourceHash)
                .catch((error: any) => console.error('Tool translation error:', error));
        }

        res.json(inLanguage(tool, null, req));
    } catch (error: any) {
        res.status(500).json({ message: 'Error updating tool', error: error.message });
    }
});

/** PATCH /api/tools/:id/published — publicar o retirar. */
router.patch('/:id/published', verifyToken, async (req: any, res: Response) => {
    const id = Number(req.params.id);
    const { published } = req.body ?? {};

    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid tool id' });
    if (typeof published !== 'boolean') {
        return res.status(400).json({ error: 'published must be true or false' });
    }

    try {
        const tool = await prisma.tool.findUnique({
            where: { id },
            select: {
                id: true, slug: true, title: true, summary: true, content: true, lang: true,
                href: true, mode: true, published: true, createdById: true, sourceHash: true,
            },
        });

        if (!tool || (!tool.published && !mayWrite(req, tool))) {
            return res.status(404).json({ error: 'Tool not found' });
        }
        if (!mayWrite(req, tool)) {
            return res.status(403).json({ error: 'Not authorized to publish this tool' });
        }

        if (published) {
            // Lo unico que no se puede doblar: una ficha sin destino es una
            // tarjeta que no lleva a ninguna parte.
            const href = validateHref(tool.href, tool.mode === 'embed' ? 'embed' : 'link');
            if (!href.ok) return refuseField(res, href.code);
        }

        if (tool.published === published) {
            return res.json({ id: tool.id, published });
        }

        const updated = await prisma.tool.update({
            where: { id: tool.id },
            data: { published },
            select: LISTED,
        });

        if (published) {
            const hash = tool.sourceHash ?? toolSourceHash(tool.title, tool.summary, tool.content);
            updateToolTranslations(updated.id, updated.title, updated.summary, updated.content, updated.lang, hash)
                .catch((error: any) => console.error('Tool translation error on publish:', error));
        }

        res.json({ id: updated.id, published });
    } catch (error: any) {
        res.status(500).json({ message: 'Error publishing tool', error: error.message });
    }
});

/** DELETE /api/tools/:id — las traducciones se van con ella. */
router.delete('/:id', verifyToken, async (req: any, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid tool id' });

    try {
        const tool = await prisma.tool.findUnique({
            where: { id },
            select: { id: true, published: true, createdById: true },
        });

        if (!tool || (!tool.published && !mayWrite(req, tool))) {
            return res.status(404).json({ error: 'Tool not found' });
        }
        if (!mayWrite(req, tool)) {
            return res.status(403).json({ error: 'Not authorized to delete this tool' });
        }

        await prisma.tool.delete({ where: { id: tool.id } });
        res.json({ message: 'Tool deleted' });
    } catch (error: any) {
        res.status(500).json({ message: 'Error deleting tool', error: error.message });
    }
});

export default router;
