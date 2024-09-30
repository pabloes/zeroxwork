import { Router } from 'express';
import { prisma } from '../db';
import {verifyToken} from "../middleware/authMiddleware";  // Asegúrate de tener la instancia de Prisma configurada
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
};
// Crear un artículo
router.post('/articles', verifyToken, async (req, res) => {
    const { title, content, thumbnail } = req.body;
    const userId = req.user.id;

    try {
        if (!title || !content) {
            return res.status(400).json({ error: 'Title and content are required' });
        }

        const article = await prisma.article.create({
            data: {
                userId,
                title,
                content,
                thumbnail: thumbnail || null, // Si el thumbnail es opcional
            },
            include
        });
        const authorAddress = article.user?.defaultName?.wallet?.address || null;
        res.status(201).json({
            ...article,
            author: article.user?.defaultName?.name || 'Anonymous', // Send the selected name or 'Anonymous' if no name is set
            authorAddress,
        });
    } catch (error) {
        res.status(500).json({ message: 'Error creating article', error: error.message });
    }
});

// Actualizar un artículo
router.put('/articles/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { title, content,thumbnail } = req.body;
    try {
        if (!title || !content) {
            return res.status(400).json({ error: 'Title and content are required' });
        }
        const updatedArticle = await prisma.article.update({
            where: { id: Number(id) },
            data: { title, content,
                thumbnail: thumbnail || null, // Si el thumbnail es opcional
            },
        });
        res.status(200).json(updatedArticle);
    } catch (error) {
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
    try {
        await prisma.article.delete({
            where: { id: Number(id) },
        });
        res.status(200).json({ message: 'Article deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting article', error: error.message });
    }
});

export default router;
