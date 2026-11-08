/**
 * Fills in the translations that published articles are missing.
 *
 * They can be missing for two reasons: the article was written into the
 * database directly (the portfolio seed does that, and never called the
 * translation service), or a language was added to the site after it was
 * published. Either way the article then only shows up in other languages
 * through the whole-list English fallback, which quietly stops working the
 * moment one article does exist in the language being read.
 *
 * Dry run by default: it prints what is missing and how many characters DeepL
 * would be asked to translate, and writes nothing.
 *
 *   npx tsx scripts/backfill-translations.ts
 *   npx tsx scripts/backfill-translations.ts --category project
 *   npx tsx scripts/backfill-translations.ts --id 2 --force
 *   npx tsx scripts/backfill-translations.ts --apply
 *
 * --id narrows it to one or more articles, comma-separated. Repairing a single
 * article that came out damaged is the point: without it, --force on a category
 * re-translates everything in that category and bills DeepL for all of it.
 *
 * --force also redoes translations that are already up to date, for when the
 * rule changed rather than the article -- keeping a project's title untranslated
 * is one such change. It drops the stored translations for the articles it is
 * about to redo; they are a cache of DeepL's answer, rebuilt from the article
 * itself, and the old slugs stay in the history so their URLs keep redirecting.
 *
 * Drafts are skipped: they are still being written.
 */

import { prisma } from '../src/db/index.js';
import { updateArticleTranslations } from '../src/services/article-translation.js';
import { computeSourceHash } from '../src/utils/slug.js';

const apply = process.argv.includes('--apply');
const force = process.argv.includes('--force');
const categoryAt = process.argv.indexOf('--category');
const onlyCategory = categoryAt !== -1 ? process.argv[categoryAt + 1] : null;
const idAt = process.argv.indexOf('--id');
const onlyIds = idAt !== -1
    ? (process.argv[idAt + 1] ?? '').split(',').map((part) => Number(part.trim())).filter(Number.isInteger)
    : null;

if (onlyIds !== null && onlyIds.length === 0) {
    console.error('--id needs at least one article id, for example --id 2 or --id 2,10');
    process.exit(1);
}

const TARGETS = ['es', 'en', 'fr', 'pt-br', 'zh'];

async function main() {
    const articles = await prisma.article.findMany({
        where: {
            published: true,
            ...(onlyIds ? { id: { in: onlyIds } } : {}),
            ...(onlyCategory ? { category: { name: { equals: onlyCategory, mode: 'insensitive' } } } : {}),
        },
        select: {
            id: true, title: true, content: true, lang: true, sourceHash: true, redirectUrl: true,
            category: { select: { name: true } },
            translations: { select: { targetLang: true, sourceHash: true } },
        },
        orderBy: { id: 'asc' },
    });

    let characters = 0;
    const pending: typeof articles = [];

    for (const article of articles) {
        const hash = article.sourceHash ?? computeSourceHash(article.title, article.content);
        const wanted = TARGETS.filter((lang) => lang !== article.lang.toLowerCase());
        const missing = force ? wanted : wanted.filter((lang) => {
            const have = article.translations.find((t) => t.targetLang.toLowerCase() === lang);
            return !have || have.sourceHash !== hash;
        });

        if (missing.length === 0) continue;

        const size = article.title.length + article.content.length;
        characters += size * missing.length;
        pending.push(article);

        console.log(
            `id=${article.id} [${article.category?.name ?? 'no category'}] ${article.lang} "${article.title}"`
            + `\n    ${force ? 'redo' : 'missing'}: ${missing.join(', ')}  (~${size * missing.length} characters)`,
        );
    }

    if (pending.length === 0) {
        const scope = onlyIds
            ? `for id ${onlyIds.join(', ')}`
            : onlyCategory ? `in "${onlyCategory}"` : '';
        console.log(scope ? `Nothing missing ${scope}.` : 'Nothing missing.');
        return;
    }

    console.log(`\n${pending.length} articles, about ${characters} characters of DeepL in total.`);

    if (!apply) {
        console.log('Dry run. Re-run with --apply to translate these.');
        return;
    }

    for (const article of pending) {
        const hash = article.sourceHash ?? computeSourceHash(article.title, article.content);
        process.stdout.write(`translating id=${article.id} ... `);
        try {
            if (force) {
                // updateArticleTranslations skips anything whose hash already
                // matches, which is every one of them when only the rule moved.
                await prisma.articleTranslation.deleteMany({ where: { articleId: article.id } });
            }
            await updateArticleTranslations(
                article.id, article.title, article.content, article.lang, hash, article.redirectUrl,
                // A project's name is its name; only its write-up gets translated.
                { keepTitle: (article.category?.name ?? '').toLowerCase() === 'project' },
            );
            console.log('done');
        } catch (error) {
            console.log('failed');
            console.error(error);
        }
    }
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
