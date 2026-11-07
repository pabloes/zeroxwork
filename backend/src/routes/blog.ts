import { Router } from 'express';
import { prisma } from "../db";
import { ROLE } from "../constants/roles";
import {verifyToken} from "../middleware/authMiddleware";
import { isEmbedUrlAllowed } from "../config/embed";
import { requireAdmin } from "../middleware/requireAdmin";
import { slugify, computeSourceHash, makeUniqueSlug } from "../utils/slug";
import { createArticleTranslations, updateArticleTranslations, updateBaseSlugHistory } from "../services/article-translation";
import { notifyAdminNewArticle } from "../services/admin-notify";
import { normaliseCredits, CreditError } from "../services/article-credits.js";
import { resolvePublicName } from "../config/public-name.js";
const router = Router();

// Shown when the requested language has no articles yet
const FALLBACK_LANG = 'en';

const include = {
        user: {
            select: {
                id: true,          // Only ever used to build the automatic name
                handle: true,
                displayName: true, // Optional public name, preferred over the wallet name
                avatarUrl: true,   // Optional uploaded avatar
                discordLink: { select: { globalName: true, username: true } },
                defaultName: {
                    select: {
                        wallet: {
                            select: {
                                address: true, // Fetch the address of the wallet owning the default name
                            },
                        },
                        name: true, // Fetch the default name as well
                    },
                },
            },
        },
        category: true,
        tags: true,
        credits: {
            orderBy: [{ position: 'asc' as const }, { id: 'asc' as const }],
            select: {
                name: true,
                role: true,
                userId: true,
                user: {
                    select: {
                        id: true, handle: true, displayName: true, avatarUrl: true,
                        discordLink: { select: { globalName: true, username: true } },
                        defaultName: { select: { name: true } },
                    },
                },
            },
        },
};

/**
 * Public author identity for an article response.
 * `author` and `authorAddress` keep exactly the meaning they always had (the
 * wallet name is what tells the frontend to use a Decentraland/Base avatar), the
 * profile fields are additive. The email is never part of this.
 */
const authorFields = (user: any) => ({
    author: user?.defaultName?.name || 'Anonymous',
    authorAddress: user?.defaultName?.wallet?.address || null,
    // Resolved, not raw: an author who never typed a name still gets their
    // Discord or on-chain one, so no byline has to read "Anonymous".
    authorDisplayName: user ? resolvePublicName(user) : null,
    authorAvatar: user?.avatarUrl || null,
});

/**
 * Credited collaborators, flattened for the frontend. `name` is what was typed
 * when the credit was created; a credit linked to an account prefers that
 * account's public name and carries the handle, which is what makes the name a
 * link to /member/<handle>.
 */
const creditFields = (credits: any[] | undefined) =>
    (credits ?? []).map((credit) => ({
        name: credit.user ? resolvePublicName(credit.user) : credit.name,
        role: credit.role ?? null,
        // Carried so the edit form can save again without dropping the link to
        // the account. No new exposure: article.userId is already public here.
        userId: credit.userId ?? null,
        handle: credit.user?.handle ?? null,
        avatarUrl: credit.user?.avatarUrl ?? null,
    }));

/** The public author and credit block every article response carries. */
const publicFields = (article: any) => ({
    ...authorFields(article.user),
    credits: creditFields(article.credits),
});

// ==================== CATEGORIES ====================

// Get all categories (public)
router.get('/categories', async (req, res) => {
    try {
        const categories = await prisma.category.findMany({
            orderBy: { name: 'asc' },
        });
        res.status(200).json(categories);
    } catch (error: any) {
        res.status(500).json({ message: 'Error fetching categories', error: error.message });
    }
});

// Create a category (admin only)
router.post('/categories', verifyToken, requireAdmin, async (req, res) => {
    const { name } = req.body;
    try {
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Category name is required' });
        }
        const category = await prisma.category.create({
            data: { name: name.trim() },
        });
        res.status(201).json(category);
    } catch (error: any) {
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Category already exists' });
        }
        res.status(500).json({ message: 'Error creating category', error: error.message });
    }
});

// ==================== TAGS ====================

// Get all tags
router.get('/tags', async (req, res) => {
    try {
        const tags = await prisma.tag.findMany({
            orderBy: { name: 'asc' },
        });
        res.status(200).json(tags);
    } catch (error: any) {
        res.status(500).json({ message: 'Error fetching tags', error: error.message });
    }
});

// Create a tag
router.post('/tags', verifyToken, async (req, res) => {
    const { name } = req.body;
    try {
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Tag name is required' });
        }
        const normalized = name.trim().toUpperCase();
        const tag = await prisma.tag.create({
            data: { name: normalized },
        });
        res.status(201).json(tag);
    } catch (error: any) {
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Tag already exists' });
        }
        res.status(500).json({ message: 'Error creating tag', error: error.message });
    }
});

// Delete a tag
router.delete('/tags/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.tag.delete({
            where: { id: Number(id) },
        });
        res.status(200).json({ message: 'Tag deleted successfully' });
    } catch (error: any) {
        res.status(500).json({ message: 'Error deleting tag', error: error.message });
    }
});

// ==================== ARTICLES ====================
// Crear un artículo
router.post('/articles', verifyToken, async (req, res) => {
    const { title, content, thumbnail, embedUrl, embedHeight, categoryId, tagIds, newTags, slug: customSlug, lang = 'es', type = 'post', redirectUrl, credits } = req.body;
    const userId = (req as any).user.id;

    try {
        if (!title) {
            return res.status(400).json({ error: 'Title is required' });
        }

        if (type === 'post' && !content) {
            return res.status(400).json({ error: 'Content is required for post type articles' });
        }

        if (type === 'link' && !redirectUrl) {
            return res.status(400).json({ error: 'Redirect URL is required for link type articles' });
        }

        // Validate embedUrl against whitelist
        if (embedUrl && !isEmbedUrlAllowed(embedUrl)) {
            return res.status(400).json({ error: 'Embed URL not allowed. Must match a whitelisted prefix (e.g. /embeds/ or approved external origins).' });
        }

        // Generate slug
        const baseSlug = customSlug ? slugify(customSlug) : slugify(title);
        const articleSlug = await makeUniqueSlug(baseSlug);

        // Compute source hash for cache invalidation
        const sourceHash = computeSourceHash(title, content);

        // Create new tags if provided
        let createdTagIds: number[] = [];
        if (newTags && Array.isArray(newTags) && newTags.length > 0) {
            for (const tagName of newTags) {
                if (tagName && tagName.trim()) {
                    const normalizedTag = tagName.trim().toUpperCase();
                    try {
                        const tag = await prisma.tag.create({
                            data: { name: normalizedTag },
                        });
                        createdTagIds.push(tag.id);
                    } catch (e: any) {
                        if (e.code === 'P2002') {
                            const existingTag = await prisma.tag.findUnique({
                                where: { name: normalizedTag },
                            });
                            if (existingTag) {
                                createdTagIds.push(existingTag.id);
                            }
                        }
                    }
                }
            }
        }

        // Combine existing tagIds with newly created ones
        const allTagIds = [...(tagIds || []), ...createdTagIds];

        // Who worked on this. Written in the same statement as the article so a
        // bad credit cannot leave a project half created.
        const cleanCredits = await normaliseCredits(credits);

        const article = await prisma.article.create({
            data: {
                userId,
                title,
                content: content || '',
                slug: articleSlug,
                lang: lang.toLowerCase(),
                sourceHash,
                embedUrl: embedUrl || null,
                embedHeight: embedHeight ? Number(embedHeight) : 600,
                thumbnail: thumbnail || null,
                published: true,
                categoryId: categoryId ? Number(categoryId) : null,
                tags: allTagIds.length > 0 ? {
                    connect: allTagIds.map((id: number) => ({ id })),
                } : undefined,
                type: type || 'post',
                redirectUrl: type === 'link' ? redirectUrl : null,
                credits: cleanCredits.length > 0
                    ? { create: cleanCredits.map((credit, position) => ({ ...credit, position })) }
                    : undefined,
            },
            include
        });

        // Create base slug history entry
        await prisma.articleSlug.create({
            data: {
                articleId: article.id,
                lang: article.lang,
                slug: article.slug,
            },
        });

        // Create translations asynchronously (don't wait for response)
        createArticleTranslations(article.id, title, content, article.lang, sourceHash, article.redirectUrl)
            .catch(err => console.error('Translation error:', err));

        const fields = publicFields(article);

        // Admin notice, same fire-and-forget shape as the translations above.
        notifyAdminNewArticle({
            title: article.title,
            author: fields.authorDisplayName || fields.author,
            category: article.category?.name || null,
            lang: article.lang,
            slug: article.slug,
        }).catch((err: any) => console.error('Admin notify error:', err));

        res.status(201).json({
            ...article,
            ...fields,
        });
    } catch (error:any) {
        if (error instanceof CreditError) {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ message: 'Error creating article', error: error.message });
    }
});

// Actualizar un artículo
router.put('/articles/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { title, content, thumbnail, embedUrl, embedHeight, categoryId, tagIds, newTags, slug: customSlug, lang, type = 'post', redirectUrl, credits } = req.body;
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;

    try {
        if (!title) {
            return res.status(400).json({ error: 'Title is required' });
        }

        if (type === 'post' && !content) {
            return res.status(400).json({ error: 'Content is required for post type articles' });
        }

        if (type === 'link' && !redirectUrl) {
            return res.status(400).json({ error: 'Redirect URL is required for link type articles' });
        }

        // Validate embedUrl against whitelist
        if (embedUrl && !isEmbedUrlAllowed(embedUrl)) {
            return res.status(400).json({ error: 'Embed URL not allowed. Must match a whitelisted prefix (e.g. /embeds/ or approved external origins).' });
        }

        // Verificar que el artículo existe
        const existingArticle = await prisma.article.findUnique({
            where: { id: Number(id) },
        });

        if (!existingArticle) {
            return res.status(404).json({ error: 'Article not found' });
        }

        // Verificar permisos: admin puede editar cualquiera, usuario solo los suyos
        if (userRole !== ROLE.ADMIN && existingArticle.userId !== userId) {
            return res.status(403).json({ error: 'Not authorized to edit this article' });
        }

        // Compute new source hash
        const newHash = computeSourceHash(title, content);
        const contentChanged = newHash !== existingArticle.sourceHash;

        // Handle slug change if provided
        let newSlug = existingArticle.slug;
        if (customSlug && slugify(customSlug) !== existingArticle.slug) {
            newSlug = await makeUniqueSlug(slugify(customSlug));
            // Update base slug history
            await updateBaseSlugHistory(existingArticle.id, existingArticle.lang, newSlug);
        }

        // Handle language change - update all base slugs to new language
        const newLang = lang ? lang.toLowerCase() : existingArticle.lang;
        if (newLang !== existingArticle.lang) {
            // Update all slugs from old language to new language
            await prisma.articleSlug.updateMany({
                where: {
                    articleId: existingArticle.id,
                    lang: existingArticle.lang,
                },
                data: {
                    lang: newLang,
                },
            });

            // Delete old translations (they're for the wrong source language now)
            await prisma.articleTranslation.deleteMany({
                where: { articleId: existingArticle.id },
            });

            // Delete translation slugs (will be recreated)
            await prisma.articleSlug.deleteMany({
                where: {
                    articleId: existingArticle.id,
                    lang: { not: newLang },
                },
            });
        }

        // Create new tags if provided
        let createdTagIds: number[] = [];
        if (newTags && Array.isArray(newTags) && newTags.length > 0) {
            for (const tagName of newTags) {
                if (tagName && tagName.trim()) {
                    const normalizedTag = tagName.trim().toUpperCase();
                    try {
                        const tag = await prisma.tag.create({
                            data: { name: normalizedTag },
                        });
                        createdTagIds.push(tag.id);
                    } catch (e: any) {
                        if (e.code === 'P2002') {
                            const existingTag = await prisma.tag.findUnique({
                                where: { name: normalizedTag },
                            });
                            if (existingTag) {
                                createdTagIds.push(existingTag.id);
                            }
                        }
                    }
                }
            }
        }

        // Combine existing tagIds with newly created ones
        const allTagIds = [...(tagIds || []), ...createdTagIds];

        // Only touch credits when the form actually sent them: a client that
        // knows nothing about credits must not wipe the ones already there.
        const creditsSent = credits !== undefined;
        const cleanCredits = creditsSent ? await normaliseCredits(credits) : [];

        const updatedArticle = await prisma.article.update({
            where: { id: Number(id) },
            data: {
                title,
                content: content || '',
                slug: newSlug,
                lang: lang ? lang.toLowerCase() : existingArticle.lang,
                sourceHash: newHash,
                embedUrl: embedUrl || null,
                embedHeight: embedHeight ? Number(embedHeight) : 600,
                thumbnail: thumbnail || null,
                categoryId: categoryId ? Number(categoryId) : null,
                tags: {
                    set: [], // Disconnect all existing tags
                    connect: allTagIds.map((tagId: number) => ({ id: tagId })), // Connect new tags
                },
                type: type || 'post',
                redirectUrl: type === 'link' ? redirectUrl : null,
                credits: creditsSent
                    ? {
                        deleteMany: {},
                        create: cleanCredits.map((credit, position) => ({ ...credit, position })),
                    }
                    : undefined,
            },
            include
        });

        // Update translations if content or language changed
        const langChanged = newLang !== existingArticle.lang;
        if (contentChanged || langChanged) {
            updateArticleTranslations(updatedArticle.id, title, content, updatedArticle.lang, newHash, updatedArticle.redirectUrl)
                .catch(err => console.error('Translation update error:', err));
        }

        res.status(200).json({
            ...updatedArticle,
            ...publicFields(updatedArticle),
        });
    } catch (error:any) {
        if (error instanceof CreditError) {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ message: 'Error updating article', error: error.message });
    }
});

// Obtener todos los artículos (con filtro opcional por idioma y categoría)
router.get('/articles', async (req, res) => {
    try {
        const { lang, category, limit, offset } = req.query;

        // Build category filter
        const categoryFilter = category && typeof category === 'string'
            ? { category: { name: { equals: category, mode: 'insensitive' as const } } }
            : {};

        if (lang && typeof lang === 'string') {
            // Return articles in requested language (base or translations)
            const normalizedLang = lang.toLowerCase();
            const limitNum = limit ? parseInt(limit as string, 10) : 100;
            const offsetNum = offset ? parseInt(offset as string, 10) : 0;

            // Build category condition for SQL
            const categoryCondition = category && typeof category === 'string'
                ? `AND LOWER(c.name) = LOWER($2)`
                : `AND TRUE`;

            // Articles written in that language plus translations into it
            const fetchForLang = async (targetLang: string) => {
                const params = category && typeof category === 'string'
                    ? [targetLang, category, limitNum, offsetNum]
                    : [targetLang, limitNum, offsetNum];

                const limitParam = category ? '$3' : '$2';
                const offsetParam = category ? '$4' : '$3';

                // Use raw SQL with UNION to get both base articles and translations, properly sorted
                const rawArticles = await prisma.$queryRawUnsafe<any[]>(`
                    SELECT
                        a.id,
                        a.title,
                        a.content,
                        a.slug,
                        a.lang,
                        a.thumbnail,
                        a."createdAt",
                        a."updatedAt",
                        a.featured,
                        a."userId",
                        c.id as "categoryId",
                        c.name as "categoryName",
                        wn.name as author,
                        w.address as "authorAddress",
                        u.id as "authorUserId",
                        u.handle as "authorHandle",
                        u."displayName" as "authorDisplayName",
                        u."avatarUrl" as "authorAvatar",
                        dl."globalName" as "authorDiscordGlobalName",
                        dl.username as "authorDiscordUsername",
                        FALSE as "isTranslation"
                    FROM articles a
                    LEFT JOIN categories c ON a."categoryId" = c.id
                    LEFT JOIN users u ON a."userId" = u.id
                    LEFT JOIN "WalletDecentralandNames" wn ON u."defaultNameId" = wn.id
                    LEFT JOIN "Wallet" w ON wn."walletId" = w.id
                    LEFT JOIN discord_links dl ON dl."userId" = u.id
                    WHERE a.published = TRUE
                    AND a.lang = $1
                    ${categoryCondition}

                    UNION ALL

                    SELECT
                        a.id,
                        t.title,
                        t.content,
                        t.slug,
                        t."targetLang" as lang,
                        a.thumbnail,
                        a."createdAt",
                        t."cachedAt" as "updatedAt",
                        a.featured,
                        a."userId",
                        c.id as "categoryId",
                        c.name as "categoryName",
                        wn.name as author,
                        w.address as "authorAddress",
                        u.id as "authorUserId",
                        u.handle as "authorHandle",
                        u."displayName" as "authorDisplayName",
                        u."avatarUrl" as "authorAvatar",
                        dl."globalName" as "authorDiscordGlobalName",
                        dl.username as "authorDiscordUsername",
                        TRUE as "isTranslation"
                    FROM article_translations t
                    JOIN articles a ON t."articleId" = a.id
                    LEFT JOIN categories c ON a."categoryId" = c.id
                    LEFT JOIN users u ON a."userId" = u.id
                    LEFT JOIN "WalletDecentralandNames" wn ON u."defaultNameId" = wn.id
                    LEFT JOIN "Wallet" w ON wn."walletId" = w.id
                    LEFT JOIN discord_links dl ON dl."userId" = u.id
                    WHERE t."targetLang" = $1
                    AND a.lang != $1
                    ${categoryCondition}

                    ORDER BY featured DESC, "createdAt" DESC
                    LIMIT ${limitParam} OFFSET ${offsetParam}
                `, ...params);

                // Get tags for each article
                const articleIds = [...new Set(rawArticles.map(a => a.id))];
                const articleTags = await prisma.article.findMany({
                    where: { id: { in: articleIds } },
                    select: { id: true, tags: true },
                });
                const tagsMap = new Map(articleTags.map(a => [a.id, a.tags]));

                // And the credits, fetched the same way: the UNION above would
                // multiply the rows if it joined them in.
                const rawCredits = await prisma.articleCredit.findMany({
                    where: { articleId: { in: articleIds } },
                    orderBy: [{ position: 'asc' }, { id: 'asc' }],
                    select: {
                        articleId: true,
                        name: true,
                        role: true,
                        userId: true,
                        user: {
                            select: {
                                id: true, handle: true, displayName: true, avatarUrl: true,
                                discordLink: { select: { globalName: true, username: true } },
                                defaultName: { select: { name: true } },
                            },
                        },
                    },
                });
                const creditsMap = new Map<number, typeof rawCredits>();
                rawCredits.forEach((credit) => {
                    const list = creditsMap.get(credit.articleId) ?? [];
                    list.push(credit);
                    creditsMap.set(credit.articleId, list);
                });

                // Format the results
                const formattedArticles = rawArticles.map(article => ({
                    id: article.id,
                    title: article.title,
                    content: article.content,
                    slug: article.slug,
                    lang: article.lang,
                    thumbnail: article.thumbnail,
                    createdAt: article.createdAt,
                    updatedAt: article.updatedAt,
                    featured: article.featured,
                    author: article.author || 'Anonymous',
                    authorAddress: article.authorAddress,
                    // Same chain as every other article response, rebuilt from the
                    // flat row: their name, else Discord, else the on-chain name,
                    // else the automatic handle.
                    authorDisplayName: article.authorUserId ? resolvePublicName({
                        id: article.authorUserId,
                        handle: article.authorHandle,
                        displayName: article.authorDisplayName,
                        discordLink: article.authorDiscordUsername
                            ? { globalName: article.authorDiscordGlobalName, username: article.authorDiscordUsername }
                            : null,
                        defaultName: article.author ? { name: article.author } : null,
                    }) : null,
                    authorAvatar: article.authorAvatar || null,
                    category: article.categoryId ? { id: article.categoryId, name: article.categoryName } : null,
                    tags: tagsMap.get(article.id) || [],
                    credits: creditFields(creditsMap.get(article.id)),
                    isTranslation: article.isTranslation,
                }));

                return formattedArticles;
            };

            let articlesForLang = await fetchForLang(normalizedLang);

            // Nothing in that language yet (translation pending or language not covered):
            // show the English ones instead of an empty page
            if (articlesForLang.length === 0 && normalizedLang !== FALLBACK_LANG) {
                articlesForLang = await fetchForLang(FALLBACK_LANG);
            }

            return res.status(200).json(articlesForLang);
        }

        // Default: return all base articles
        const articles = await prisma.article.findMany({
            where: {
                published: true,
                ...categoryFilter,
            },
            include,
            orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
        });
        const formattedArticles = articles.map((article) => ({
            ...article,
            ...publicFields(article),
        }));

        res.status(200).json(formattedArticles);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching articles', error: error.message });
    }
});

// Obtener artículo por slug (con soporte para redirects 301)
router.get('/articles/by-slug/:slug', async (req, res) => {
    const { slug } = req.params;

    try {
        // Find slug in history
        const slugRecord = await prisma.articleSlug.findUnique({
            where: { slug },
        });

        if (!slugRecord) {
            return res.status(404).json({ message: 'Article not found' });
        }

        // Check if this slug is the most recent for this article+lang
        const currentSlug = await prisma.articleSlug.findFirst({
            where: {
                articleId: slugRecord.articleId,
                lang: slugRecord.lang,
            },
            orderBy: { createdAt: 'desc' },
        });

        // If slug is not current, redirect to current slug
        if (currentSlug && currentSlug.id !== slugRecord.id) {
            return res.status(301).json({
                redirect: true,
                slug: currentSlug.slug,
            });
        }

        // Load the base article
        const article = await prisma.article.findUnique({
            where: { id: slugRecord.articleId },
            include,
        });

        if (!article) {
            return res.status(404).json({ message: 'Article not found' });
        }

        // If requesting base language, return base article
        if (slugRecord.lang === article.lang) {
            // Get all current slugs for hreflang (most recent per lang)
            const allSlugsRaw = await prisma.articleSlug.findMany({
                where: { articleId: article.id },
                orderBy: { createdAt: 'desc' },
            });
            const currentSlugs = Object.values(
                allSlugsRaw.reduce((acc, s) => {
                    if (!acc[s.lang]) acc[s.lang] = s;
                    return acc;
                }, {} as Record<string, typeof allSlugsRaw[0]>)
            );

            return res.status(200).json({
                ...article,
                ...publicFields(article),
                hreflang: currentSlugs.map(s => ({ lang: s.lang, slug: s.slug })),
            });
        }

        // Find translation for this language
        const translation = await prisma.articleTranslation.findUnique({
            where: {
                articleId_targetLang: {
                    articleId: article.id,
                    targetLang: slugRecord.lang,
                },
            },
        });

        // If translation exists and is up to date, return it
        if (translation && translation.sourceHash === article.sourceHash) {
            // Get all current slugs for hreflang (most recent per lang)
            const allSlugsRaw = await prisma.articleSlug.findMany({
                where: { articleId: article.id },
                orderBy: { createdAt: 'desc' },
            });
            const currentSlugs = Object.values(
                allSlugsRaw.reduce((acc, s) => {
                    if (!acc[s.lang]) acc[s.lang] = s;
                    return acc;
                }, {} as Record<string, typeof allSlugsRaw[0]>)
            );

            return res.status(200).json({
                id: article.id,
                title: translation.title,
                content: translation.content,
                slug: translation.slug,
                lang: translation.targetLang,
                embedUrl: article.embedUrl,
                embedHeight: article.embedHeight,
                thumbnail: article.thumbnail,
                createdAt: article.createdAt,
                updatedAt: translation.cachedAt,
                ...publicFields(article),
                category: article.category,
                tags: article.tags,
                type: article.type,
                redirectUrl: translation.redirectUrl || article.redirectUrl,
                isTranslation: true,
                originalLang: article.lang,
                originalSlug: article.slug,
                hreflang: currentSlugs.map(s => ({ lang: s.lang, slug: s.slug })),
            });
        }

        // Fallback to base article
        const allSlugsRaw = await prisma.articleSlug.findMany({
            where: { articleId: article.id },
            orderBy: { createdAt: 'desc' },
        });
        const currentSlugs = Object.values(
            allSlugsRaw.reduce((acc, s) => {
                if (!acc[s.lang]) acc[s.lang] = s;
                return acc;
            }, {} as Record<string, typeof allSlugsRaw[0]>)
        );

        return res.status(200).json({
            ...article,
            ...publicFields(article),
            hreflang: currentSlugs.map(s => ({ lang: s.lang, slug: s.slug })),
            fallback: true,
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching article', error: error.message });
    }
});

router.get('/my-articles', verifyToken, async (req, res) => {
    try {
        const articles = await prisma.article.findMany({
            where: { userId: req.user.id },
            include,
            orderBy: [
                { featured: 'desc' }, // Sort by featured first, with true values first
                { createdAt: 'desc' }, // Optionally, sort by creation date next
            ],
        });


        const formattedArticles = articles.map((article) => ({
            ...article,
            ...publicFields(article),
        }));

        res.status(200).json(formattedArticles);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching articles', error: error.message });
    }
});
// Obtener un artículo por ID
// Obtener un artículo por ID
router.get('/articles/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // Accepts an id or a slug. The editor redirects here with whichever it
        // has after saving, and a slug used to reach Prisma as NaN and 500.
        const numericId = /^\d+$/.test(id) ? Number(id) : null;

        const article = numericId !== null
            ? await prisma.article.findUnique({ where: { id: numericId }, include })
            : await prisma.article.findFirst({ where: { slug: id }, include });

        if (!article) {
            return res.status(404).json({ message: 'Article not found' });
        }
        res.status(200).json({
            ...article,
            ...publicFields(article),
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching article', error: error.message });
    }
});


/**
 * DELETE /api/blog/articles/:id/credits/me
 * Anyone may credit anyone, so anyone must be able to step out of a project
 * they do not want to appear in. Removes only the caller's own credit; the
 * article and every other credit are left alone.
 */
router.delete('/articles/:id/credits/me', verifyToken, async (req, res) => {
    const articleId = Number(req.params.id);
    const userId = (req as any).user.id;

    if (!Number.isInteger(articleId)) {
        return res.status(400).json({ error: 'Invalid article id' });
    }

    try {
        const removed = await prisma.articleCredit.deleteMany({
            where: { articleId, userId },
        });

        if (removed.count === 0) {
            return res.status(404).json({ error: 'You are not credited on this article' });
        }

        res.status(200).json({ removed: removed.count });
    } catch (error: any) {
        res.status(500).json({ message: 'Error removing credit', error: error.message });
    }
});

// Eliminar un artículo
router.delete('/articles/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;

    try {
        // Verificar que el artículo existe
        const existingArticle = await prisma.article.findUnique({
            where: { id: Number(id) },
        });

        if (!existingArticle) {
            return res.status(404).json({ error: 'Article not found' });
        }

        // Verificar permisos: admin puede eliminar cualquiera, usuario solo los suyos
        if (userRole !== ROLE.ADMIN && existingArticle.userId !== userId) {
            return res.status(403).json({ error: 'Not authorized to delete this article' });
        }

        await prisma.article.delete({
            where: { id: Number(id) },
        });
        res.status(200).json({ message: 'Article deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting article', error: error.message });
    }
});

export default router;
