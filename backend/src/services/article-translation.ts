import { prisma } from '../db';
import { slugify, computeSourceHash, makeUniqueSlug } from '../utils/slug';
import { translateArticle, getTargetLangs, SUPPORTED_LANGS } from './deepl';

/**
 * Create translations for all target languages
 */
export async function createArticleTranslations(
    articleId: number,
    title: string,
    content: string,
    sourceLang: string,
    sourceHash: string,
    redirectUrl?: string | null
): Promise<void> {
    const targetLangs = getTargetLangs(sourceLang);

    for (const targetLang of targetLangs) {
        try {
            // Translate content
            const translated = await translateArticle(title, content, targetLang);

            // Generate unique slug for translation
            const baseSlug = slugify(translated.title);
            const translatedSlug = await makeUniqueSlug(baseSlug);

            // Create translation record
            await prisma.articleTranslation.create({
                data: {
                    articleId,
                    targetLang: targetLang.toLowerCase(),
                    slug: translatedSlug,
                    title: translated.title,
                    content: translated.content,
                    sourceHash,
                    provider: 'deepl',
                    redirectUrl: redirectUrl || null,
                },
            });

            // Create slug history entry
            await prisma.articleSlug.create({
                data: {
                    articleId,
                    lang: targetLang.toLowerCase(),
                    slug: translatedSlug,
                },
            });

            console.log(`Created translation for article ${articleId} in ${targetLang}`);
        } catch (error) {
            console.error(`Failed to translate article ${articleId} to ${targetLang}:`, error);
            // Continue with other translations even if one fails
        }
    }
}

/**
 * Update translations when source content changes
 */
export async function updateArticleTranslations(
    articleId: number,
    title: string,
    content: string,
    sourceLang: string,
    newHash: string,
    redirectUrl?: string | null
): Promise<void> {
    const targetLangs = getTargetLangs(sourceLang);

    for (const targetLang of targetLangs) {
        try {
            const existingTranslation = await prisma.articleTranslation.findUnique({
                where: {
                    articleId_targetLang: {
                        articleId,
                        targetLang: targetLang.toLowerCase(),
                    },
                },
            });

            // Skip if translation is up to date
            if (existingTranslation?.sourceHash === newHash) {
                continue;
            }

            // Translate content
            const translated = await translateArticle(title, content, targetLang);

            // Generate new slug for translation
            const baseSlug = slugify(translated.title);
            const translatedSlug = await makeUniqueSlug(baseSlug);

            if (existingTranslation) {
                // Update translation
                await prisma.articleTranslation.update({
                    where: {
                        articleId_targetLang: {
                            articleId,
                            targetLang: targetLang.toLowerCase(),
                        },
                    },
                    data: {
                        slug: translatedSlug,
                        title: translated.title,
                        content: translated.content,
                        sourceHash: newHash,
                        cachedAt: new Date(),
                        redirectUrl: redirectUrl || null,
                    },
                });
            } else {
                // Create new translation
                await prisma.articleTranslation.create({
                    data: {
                        articleId,
                        targetLang: targetLang.toLowerCase(),
                        slug: translatedSlug,
                        title: translated.title,
                        content: translated.content,
                        sourceHash: newHash,
                        provider: 'deepl',
                        redirectUrl: redirectUrl || null,
                    },
                });
            }

            // Create new slug history entry (most recent by createdAt is current)
            await prisma.articleSlug.create({
                data: {
                    articleId,
                    lang: targetLang.toLowerCase(),
                    slug: translatedSlug,
                },
            });

            console.log(`Updated translation for article ${articleId} in ${targetLang}`);
        } catch (error) {
            console.error(`Failed to update translation for article ${articleId} to ${targetLang}:`, error);
        }
    }
}

/**
 * Update base article slug history when slug changes
 */
export async function updateBaseSlugHistory(
    articleId: number,
    lang: string,
    newSlug: string
): Promise<void> {
    // Create new slug entry (most recent by createdAt is current)
    await prisma.articleSlug.create({
        data: {
            articleId,
            lang,
            slug: newSlug,
        },
    });
}
