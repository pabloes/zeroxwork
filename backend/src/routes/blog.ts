import { Router } from 'express';
import { prisma } from "../db";
import { ROLE } from "../constants/roles";
import {verifyToken} from "../middleware/authMiddleware";  // Asegúrate de tener la instancia de Prisma configurada
import requireAdminIfScript from "../middleware/requireAdminIfScript";
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
    const { title, content, thumbnail, script, categoryId, tagIds, newTags } = req.body;
    const userId = (req as any).user.id;

    try {
        if (!title || !content) {
            return res.status(400).json({ error: 'Title and content are required' });
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

        const article = await prisma.article.create({
            data: {
                userId,
                title,
                content,
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
    const { title, content, thumbnail, script, categoryId, tagIds, newTags } = req.body;
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
        res.status(200).json(updatedArticle);
    } catch (error:any) {
        res.status(500).json({ message: 'Error updating article', error: error.message });
    }
});

// Obtener todos los artículos
// Obtener todos los artículos
router.get('/articles', async (req, res) => {
    try {
        const articles = await prisma.article.findMany({
            where: { published: true },
            include
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
