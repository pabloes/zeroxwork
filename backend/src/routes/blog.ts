import { Router } from 'express';
import { prisma } from "../db";
import { ROLE } from "../constants/roles";
import {verifyToken} from "../middleware/authMiddleware";
import requireAdminIfScript from "../middleware/requireAdminIfScript";
import { slugify, computeSourceHash, makeUniqueSlug } from "../utils/slug";
import { createArticleTranslations, updateArticleTranslations, updateBaseSlugHistory } from "../services/article-translation";
const router = Router();

const include = {
        user: {
            select: {
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
};

// ==================== CATEGORIES ====================

// Get all categories
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

// Create a category (admin only would be ideal, but keeping it simple)
router.post('/categories', verifyToken, async (req, res) => {
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

// Update a category
router.put('/categories/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    try {
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Category name is required' });
        }
        const category = await prisma.category.update({
            where: { id: Number(id) },
            data: { name: name.trim() },
        });
        res.status(200).json(category);
    } catch (error: any) {
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Category already exists' });
        }
        res.status(500).json({ message: 'Error updating category', error: error.message });
    }
});

// Delete a category
router.delete('/categories/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.category.delete({
            where: { id: Number(id) },
        });
        res.status(200).json({ message: 'Category deleted successfully' });
    } catch (error: any) {
        res.status(500).json({ message: 'Error deleting category', error: error.message });
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
        const tag = await prisma.tag.create({
            data: { name: name.trim() },
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
router.post('/articles', verifyToken, requireAdminIfScript, async (req, res) => {
    const { title, content, thumbnail, script, categoryId, tagIds, newTags, slug: customSlug, lang = 'es' } = req.body;
    const userId = (req as any).user.id;

    try {
        if (!title || !content) {
            return res.status(400).json({ error: 'Title and content are required' });
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
                    try {
                        const tag = await prisma.tag.create({
                            data: { name: tagName.trim() },
                        });
                        createdTagIds.push(tag.id);
                    } catch (e: any) {
                        // Tag already exists, find it
                        if (e.code === 'P2002') {
                            const existingTag = await prisma.tag.findUnique({
                                where: { name: tagName.trim() },
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

        const article = await prisma.article.create({
            data: {
                userId,
                title,
                content,
                slug: articleSlug,
                lang: lang.toLowerCase(),
                sourceHash,
                script: script && typeof script === 'string' && script.trim().length ? script : null,
                thumbnail: thumbnail || null,
                published: true,
                categoryId: categoryId ? Number(categoryId) : null,
                tags: allTagIds.length > 0 ? {
                    connect: allTagIds.map((id: number) => ({ id })),
                } : undefined,
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
        createArticleTranslations(article.id, title, content, article.lang, sourceHash)
            .catch(err => console.error('Translation error:', err));

        const authorAddress = article.user?.defaultName?.wallet?.address || null;
        res.status(201).json({
            ...article,
            author: article.user?.defaultName?.name || 'Anonymous',
            authorAddress,
        });
    } catch (error:any) {
        res.status(500).json({ message: 'Error creating article', error: error.message });
    }
});

// Actualizar un artículo
router.put('/articles/:id', verifyToken, requireAdminIfScript, async (req, res) => {
    const { id } = req.params;
    const { title, content, thumbnail, script, categoryId, tagIds, newTags, slug: customSlug, lang } = req.body;
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;

    try {
        if (!title || !content) {
            return res.status(400).json({ error: 'Title and content are required' });
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
                    try {
                        const tag = await prisma.tag.create({
                            data: { name: tagName.trim() },
                        });
                        createdTagIds.push(tag.id);
                    } catch (e: any) {
                        // Tag already exists, find it
                        if (e.code === 'P2002') {
                            const existingTag = await prisma.tag.findUnique({
                                where: { name: tagName.trim() },
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

        const updatedArticle = await prisma.article.update({
            where: { id: Number(id) },
            data: {
                title,
                content,
                slug: newSlug,
                lang: lang ? lang.toLowerCase() : existingArticle.lang,
                sourceHash: newHash,
                script: script && typeof script === 'string' && script.trim().length ? script : null,
                thumbnail: thumbnail || null,
                categoryId: categoryId ? Number(categoryId) : null,
                tags: {
                    set: [], // Disconnect all existing tags
                    connect: allTagIds.map((tagId: number) => ({ id: tagId })), // Connect new tags
                },
            },
            include
        });

        // Update translations if content or language changed
        const langChanged = newLang !== existingArticle.lang;
        if (contentChanged || langChanged) {
            updateArticleTranslations(updatedArticle.id, title, content, updatedArticle.lang, newHash)
                .catch(err => console.error('Translation update error:', err));
        }

        res.status(200).json(updatedArticle);
    } catch (error:any) {
        res.status(500).json({ message: 'Error updating article', error: error.message });
    }
});

// Obtener todos los artículos (con filtro opcional por idioma y categoría)
router.get('/articles', async (req, res) => {
    try {
        const { lang, category } = req.query;

        // Build category filter
        const categoryFilter = category && typeof category === 'string'
            ? { category: { name: { equals: category, mode: 'insensitive' as const } } }
            : {};

        if (lang && typeof lang === 'string') {
            // Return articles in requested language (base or translations)
            const normalizedLang = lang.toLowerCase();

            // Get base articles in this language
            const baseArticles = await prisma.article.findMany({
                where: {
                    published: true,
                    lang: normalizedLang,
                    ...categoryFilter,
                },
                include,
                orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
            });

            // Get translations in this language
            const translations = await prisma.articleTranslation.findMany({
                where: {
                    targetLang: normalizedLang,
                    article: categoryFilter,
                },
                include: {
                    article: {
                        include,
                    },
                },
            });

            // Format base articles
            const formattedBase = baseArticles.map((article) => {
                const authorAddress = article.user?.defaultName?.wallet?.address || null;
                return {
                    id: article.id,
                    title: article.title,
                    content: article.content,
                    slug: article.slug,
                    lang: article.lang,
                    thumbnail: article.thumbnail,
                    createdAt: article.createdAt,
                    updatedAt: article.updatedAt,
                    author: article.user?.defaultName?.name || 'Anonymous',
                    authorAddress,
                    category: article.category,
                    tags: article.tags,
                };
            });

            // Format translations (exclude if base article is already in this lang)
            const baseArticleIds = new Set(baseArticles.map(a => a.id));
            const formattedTranslations = translations
                .filter(t => !baseArticleIds.has(t.articleId))
                .map((t) => {
                    const article = t.article;
                    const authorAddress = article.user?.defaultName?.wallet?.address || null;
                    return {
                        id: article.id,
                        title: t.title,
                        content: t.content,
                        slug: t.slug,
                        lang: t.targetLang,
                        thumbnail: article.thumbnail,
                        createdAt: article.createdAt,
                        updatedAt: t.cachedAt,
                        author: article.user?.defaultName?.name || 'Anonymous',
                        authorAddress,
                        category: article.category,
                        tags: article.tags,
                        isTranslation: true,
                    };
                });

            const allArticles = [...formattedBase, ...formattedTranslations]
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            return res.status(200).json(allArticles);
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
        const formattedArticles = articles.map((article) => {
            const authorAddress = article.user?.defaultName?.wallet?.address || null;
            return {
                ...article,
                author: article.user?.defaultName?.name || 'Anonymous',
                authorAddress
            }
        });

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
            const authorAddress = article.user?.defaultName?.wallet?.address || null;

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
                author: article.user?.defaultName?.name || 'Anonymous',
                authorAddress,
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
            const authorAddress = article.user?.defaultName?.wallet?.address || null;

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
                script: article.script,
                thumbnail: article.thumbnail,
                createdAt: article.createdAt,
                updatedAt: translation.cachedAt,
                author: article.user?.defaultName?.name || 'Anonymous',
                authorAddress,
                category: article.category,
                tags: article.tags,
                isTranslation: true,
                originalLang: article.lang,
                originalSlug: article.slug,
                hreflang: currentSlugs.map(s => ({ lang: s.lang, slug: s.slug })),
            });
        }

        // Fallback to base article
        const authorAddress = article.user?.defaultName?.wallet?.address || null;
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
            author: article.user?.defaultName?.name || 'Anonymous',
            authorAddress,
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


        const formattedArticles = articles.map((article) => {
            const authorAddress = article.user?.defaultName?.wallet?.address || null;
            return {
                ...article,
                author: article.user?.defaultName?.name || 'Anonymous', // Send the author's name or 'Anonymous'
                authorAddress
            }
        });

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
        const article = await prisma.article.findUnique({
            where: { id: Number(id) },
            include
        });

        if (!article) {
            return res.status(404).json({ message: 'Article not found' });
        }
        const authorAddress = article.user?.defaultName?.wallet?.address || null;

        res.status(200).json({
            ...article,
            author: article.user?.defaultName?.name || 'Anonymous', // Send the author's name
            authorAddress
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching article', error: error.message });
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
