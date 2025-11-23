import { Database, Resource } from '@adminjs/prisma';
import { PrismaClient } from '@prisma/client';
import AdminJS from 'adminjs';

export const prisma = new PrismaClient();

// Middleware to delete associated slugs when ArticleTranslation is deleted
prisma.$use(async (params, next) => {
    if (params.model === 'ArticleTranslation' && params.action === 'delete') {
        // Get the translation before deleting
        const translation = await prisma.articleTranslation.findUnique({
            where: params.args.where,
        });

        if (translation) {
            // Delete associated slugs
            await prisma.articleSlug.deleteMany({
                where: {
                    articleId: translation.articleId,
                    lang: translation.targetLang,
                },
            });
        }
    }

    // Handle deleteMany
    if (params.model === 'ArticleTranslation' && params.action === 'deleteMany') {
        // Get translations before deleting
        const translations = await prisma.articleTranslation.findMany({
            where: params.args.where,
        });

        for (const translation of translations) {
            await prisma.articleSlug.deleteMany({
                where: {
                    articleId: translation.articleId,
                    lang: translation.targetLang,
                },
            });
        }
    }

    return next(params);
});

AdminJS.registerAdapter({ Database, Resource });

const initialize = async () => ({ prisma });

export default initialize;
