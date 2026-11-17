import { Database, Resource } from '@adminjs/prisma';
import { PrismaClient } from '@prisma/client';
import AdminJS from 'adminjs';
import { discordIdsLosingTheirLink } from '../services/discord-unlink-watch.js';

export const prisma = new PrismaClient();

// Tell the Discord bot whenever a link goes away, whatever made it go. The bot
// no longer finds out by itself: see services/discord-unlink-watch.ts.
prisma.$use(async (params, next) => {
    const leaving = await discordIdsLosingTheirLink(params, {
        linksWhere: (where) => prisma.discordLink.findMany({ where: where as any, select: { discordId: true } }),
        linksOfUsersWhere: (where) => prisma.discordLink.findMany({ where: { user: where as any }, select: { discordId: true } }),
    });

    const result = await next(params);

    // After, not before: a delete that failed must not cost anybody their role.
    for (const discordId of leaving) {
        await prisma.discordSyncJob.create({ data: { discordId, reason: 'unlinked' } })
            .catch(() => console.error('Could not tell the bot about an unlink: that role has to be taken off by hand'));
    }
    return result;
});

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
