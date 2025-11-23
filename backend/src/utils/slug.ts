import crypto from 'crypto';
import { prisma } from '../db';
import { pinyin } from 'pinyin-pro';

/**
 * Convert text to URL-friendly slug
 * Supports Chinese characters by converting to pinyin
 */
export function slugify(text: string): string {
    // Check if text contains Chinese characters
    const hasChinese = /[\u4e00-\u9fa5]/.test(text);

    let processed = text;
    if (hasChinese) {
        // Convert Chinese to pinyin (space-separated, no tones)
        processed = pinyin(text, { toneType: 'none', type: 'array' }).join(' ');
    }

    return processed
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/[^a-z0-9\s-]/g, '')    // Remove special chars
        .trim()
        .replace(/\s+/g, '-')            // Spaces to hyphens
        .replace(/-+/g, '-')             // Multiple hyphens to single
        .replace(/^-|-$/g, '');          // Remove leading/trailing hyphens
}

/**
 * Compute SHA1 hash of title + content for cache invalidation
 */
export function computeSourceHash(title: string, content: string): string {
    return crypto
        .createHash('sha1')
        .update(title + '\n' + content)
        .digest('hex');
}

/**
 * Generate a unique slug by checking ArticleSlug table
 * If slug exists, append -2, -3, etc.
 */
export async function makeUniqueSlug(baseSlug: string): Promise<string> {
    let slug = baseSlug;
    let counter = 1;

    while (true) {
        const existing = await prisma.articleSlug.findUnique({
            where: { slug }
        });

        if (!existing) {
            return slug;
        }

        counter++;
        slug = `${baseSlug}-${counter}`;
    }
}

/**
 * Check if a slug is available (not in ArticleSlug history)
 */
export async function isSlugAvailable(slug: string, excludeArticleId?: number): Promise<boolean> {
    const existing = await prisma.articleSlug.findUnique({
        where: { slug }
    });

    if (!existing) return true;
    if (excludeArticleId && existing.articleId === excludeArticleId) return true;

    return false;
}
