/**
 * Seed (or re-seed) the portfolio projects defined in
 * src/constants/portfolio-seed.ts.
 *
 * Usage:
 *   npx tsx scripts/seed-portfolio.ts                      # dry-run, writes nothing
 *   npx tsx scripts/seed-portfolio.ts --apply              # create / update
 *   npx tsx scripts/seed-portfolio.ts --apply --translate  # ...and ask DeepL for
 *                                                          # the other languages
 *
 * Only ever creates and updates: no row is deleted and nothing outside these
 * projects is touched. Safe to run repeatedly — matching is by slug, so a second
 * run updates what the first one created.
 *
 * The author of the articles is the account given by --author <email>, or
 * PORTFOLIO_AUTHOR_EMAIL, or else the oldest ADMIN account.
 */

import { PrismaClient } from '@prisma/client';
import { PORTFOLIO_CATEGORY, PORTFOLIO_PROJECTS, type SeedProject } from '../src/constants/portfolio-seed';
import { computeSourceHash } from '../src/utils/slug';
import { createArticleTranslations } from '../src/services/article-translation';

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');
const translate = process.argv.includes('--translate');
const authorArg = process.argv.indexOf('--author');
const authorEmail = authorArg !== -1 ? process.argv[authorArg + 1] : process.env.PORTFOLIO_AUTHOR_EMAIL;

/** Host and database name of the target, so it is obvious which one this is. */
function describeTarget(): string {
    try {
        const url = new URL(process.env.DATABASE_URL ?? '');
        return `${url.hostname}:${url.port || '5432'}${url.pathname}`;
    } catch {
        return '(DATABASE_URL unreadable)';
    }
}

async function resolveAuthor() {
    if (authorEmail) {
        const user = await prisma.user.findUnique({ where: { email: authorEmail }, select: { id: true, email: true } });
        if (!user) throw new Error(`No account with the email ${authorEmail}`);
        return user;
    }
    const admin = await prisma.user.findFirst({
        where: { role: 'ADMIN' },
        orderBy: { id: 'asc' },
        select: { id: true, email: true },
    });
    if (!admin) throw new Error('No ADMIN account found. Pass --author <email>.');
    return admin;
}

async function seedProject(project: SeedProject, authorId: number, categoryId: number) {
    console.log(`\n--- ${project.title} (/${project.slug}) ---`);

    const tagIds: number[] = [];
    for (const name of project.tags) {
        const normalized = name.trim().toUpperCase();
        const existing = await prisma.tag.findUnique({ where: { name: normalized } });
        if (existing) {
            tagIds.push(existing.id);
        } else {
            console.log(`  tag: create "${normalized}"`);
            if (apply) {
                const created = await prisma.tag.create({ data: { name: normalized } });
                tagIds.push(created.id);
            }
        }
    }

    const sourceHash = computeSourceHash(project.title, project.content);
    const data = {
        title: project.title,
        content: project.content,
        lang: project.lang,
        thumbnail: project.thumbnail,
        categoryId,
        sourceHash,
        published: true,
        type: 'post',
    };

    const existing = await prisma.article.findUnique({ where: { slug: project.slug }, select: { id: true } });
    let articleId = existing?.id ?? 0;

    if (existing) {
        console.log(`  article: update id=${existing.id}`);
        if (apply) {
            await prisma.article.update({
                where: { id: existing.id },
                // `set` and not `connect`: the tag list in the seed file is the
                // whole truth for these projects.
                data: { ...data, tags: { set: tagIds.map((id) => ({ id })) } },
            });
        }
    } else {
        console.log('  article: create');
        if (apply) {
            const created = await prisma.article.create({
                data: {
                    ...data,
                    slug: project.slug,
                    userId: authorId,
                    tags: { connect: tagIds.map((id) => ({ id })) },
                },
            });
            articleId = created.id;
            // Without this row GET /articles/by-slug/<slug> answers 404.
            await prisma.articleSlug.create({
                data: { articleId: created.id, lang: project.lang, slug: project.slug },
            });
        }
    }

    if (!apply) {
        project.credits.forEach((credit) => console.log(`  credit: ${credit.name}${credit.handle ? ` (@${credit.handle})` : ''}`));
        return;
    }

    // Credits. Matching is by (articleId, name), so re-running relinks a credit
    // whose owner has claimed their handle since the last run.
    for (const [position, credit] of project.credits.entries()) {
        const linked = credit.handle
            ? await prisma.user.findUnique({ where: { handle: credit.handle }, select: { id: true } })
            : null;

        await prisma.articleCredit.upsert({
            where: { articleId_name: { articleId, name: credit.name } },
            create: {
                articleId,
                name: credit.name,
                role: credit.role ?? null,
                position,
                userId: linked?.id ?? null,
            },
            update: { role: credit.role ?? null, position, userId: linked?.id ?? null },
        });

        console.log(`  credit: ${credit.name}${credit.handle ? ` (@${credit.handle})` : ''} -> ${
            linked ? `linked to account ${linked.id}` : 'name only, no account with that handle yet'
        }`);
    }

    if (translate) {
        console.log('  translations: asking DeepL...');
        // keepTitle: a project is called what it is called in every language.
        await createArticleTranslations(articleId, project.title, project.content, project.lang, sourceHash, null, { keepTitle: true });
    }
}

async function main() {
    console.log('\n=== Seed: portfolio projects ===');
    console.log(`Mode:     ${apply ? 'APPLY' : 'DRY RUN (nothing is written)'}`);
    console.log(`Database: ${describeTarget()}`);

    const author = await resolveAuthor();
    console.log(`Author:   ${author.email} (id=${author.id})`);

    let categoryId = 0;
    const category = await prisma.category.findUnique({ where: { name: PORTFOLIO_CATEGORY } });
    if (category) {
        categoryId = category.id;
        console.log(`Category: "${PORTFOLIO_CATEGORY}" already exists (id=${category.id})`);
    } else {
        console.log(`Category: create "${PORTFOLIO_CATEGORY}"`);
        if (apply) {
            categoryId = (await prisma.category.create({ data: { name: PORTFOLIO_CATEGORY } })).id;
        }
    }

    for (const project of PORTFOLIO_PROJECTS) {
        await seedProject(project, author.id, categoryId);
    }

    console.log(
        apply
            ? '\nDone. Any credit reported as "name only" links itself on the next run, once that person sets the handle on /account.\n'
            : '\nDry run finished. Re-run with --apply to write it.\n'
    );
}

main()
    .catch((error) => {
        console.error('\nSeeding failed:', error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
