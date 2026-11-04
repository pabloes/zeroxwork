/**
 * Backfill: create the missing article translations for the supported languages.
 *
 * Added when French joined the site: every article published before that has no
 * FR translation, so the blog looks empty for French readers.
 *
 * Usage:
 *   npx tsx scripts/backfill-missing-translations.ts                 # dry-run, all languages
 *   npx tsx scripts/backfill-missing-translations.ts --apply         # translate and store
 *   npx tsx scripts/backfill-missing-translations.ts --lang=FR --apply
 *
 * Only inserts rows that are missing, so it is safe to run again.
 * Needs DEEPL_API_KEY and consumes DeepL quota (title + content per article).
 */

import { PrismaClient } from '@prisma/client';
import { translateArticle, SUPPORTED_LANGS } from '../src/services/deepl';
import { slugify, makeUniqueSlug } from '../src/utils/slug';

const prisma = new PrismaClient();
const dryRun = !process.argv.includes('--apply');
const langArg = process.argv.find(a => a.startsWith('--lang='))?.split('=')[1]?.toUpperCase();

async function main() {
    const targets = langArg ? [langArg] : [...SUPPORTED_LANGS];

    console.log(`\n=== Backfill: missing article translations ===`);
    console.log(`Mode: ${dryRun ? 'DRY RUN' : 'APPLY'}`);
    console.log(`Languages: ${targets.join(', ')}\n`);

    if (langArg && !SUPPORTED_LANGS.includes(langArg as any)) {
        console.error(`Unknown language "${langArg}". Supported: ${SUPPORTED_LANGS.join(', ')}`);
        process.exitCode = 1;
        return;
    }

    const articles = await prisma.article.findMany({
        where: { published: true },
        include: { translations: { select: { targetLang: true } } },
        orderBy: { id: 'asc' },
    });

    let created = 0;
    let skipped = 0;
    let failed = 0;

    for (const article of articles) {
        const sourceLang = article.lang.toUpperCase();
        const existing = new Set(article.translations.map(t => t.targetLang.toUpperCase()));

        for (const targetLang of targets) {
            if (targetLang === sourceLang || existing.has(targetLang)) {
                skipped++;
                continue;
            }

            const label = `article ${article.id} (${article.lang}) -> ${targetLang}`;

            if (dryRun) {
                console.log(`  WOULD TRANSLATE: ${label} — "${article.title}"`);
                created++;
                continue;
            }

            try {
                const translated = await translateArticle(article.title, article.content, targetLang);
                const translatedSlug = await makeUniqueSlug(slugify(translated.title));

                await prisma.articleTranslation.create({
                    data: {
                        articleId: article.id,
                        targetLang: targetLang.toLowerCase(),
                        slug: translatedSlug,
                        title: translated.title,
                        content: translated.content,
                        sourceHash: article.sourceHash,
                        provider: 'deepl',
                        redirectUrl: article.redirectUrl || null,
                    },
                });

                await prisma.articleSlug.create({
                    data: {
                        articleId: article.id,
                        lang: targetLang.toLowerCase(),
                        slug: translatedSlug,
                    },
                });

                console.log(`  CREATED: ${label} — "${translated.title}"`);
                created++;
            } catch (error: any) {
                console.error(`  FAILED: ${label} — ${error.message}`);
                failed++;
            }
        }
    }

    console.log(`\n${dryRun ? 'Would create' : 'Created'}: ${created} | already present: ${skipped} | failed: ${failed}`);
    if (dryRun) console.log('Run again with --apply to write them.\n');
}

main()
    .catch(e => {
        console.error(e);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
