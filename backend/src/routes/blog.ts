import { Router } from 'express';
import { prisma } from '../db';  // Asegúrate de tener la instancia de Prisma configurada
const router = Router();

// Crear un artículo
router.post('/articles', async (req, res) => {
    const { title, content } = req.body;
    try {
        const article = await prisma.article.create({
            data: {
                title,
                content,
            },
        });
        res.status(201).json(article);
    } catch (error) {
        res.status(500).json({ message: 'Error creating article', error: error.message });
    }
});

// Obtener todos los artículos
router.get('/articles', async (req, res) => {
    try {
        const articles = await prisma.article.findMany();
        res.status(200).json(articles);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching articles', error: error.message });
    }
});

// Obtener un artículo por ID
router.get('/articles/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const article = await prisma.article.findUnique({
            where: { id: Number(id) },
        });
        if (!article) {
            return res.status(404).json({ message: 'Article not found' });
        }
        res.status(200).json(article);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching article', error: error.message });
    }
});

// Actualizar un artículo
router.put('/articles/:id', async (req, res) => {
    const { id } = req.params;
    const { title, content } = req.body;
    try {
        const updatedArticle = await prisma.article.update({
            where: { id: Number(id) },
            data: { title, content },
        });
        res.status(200).json(updatedArticle);
    } catch (error) {
        res.status(500).json({ message: 'Error updating article', error: error.message });
    }
});

// Eliminar un artículo
router.delete('/articles/:id', async (req, res) => {
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
