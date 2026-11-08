/**
 * Phase 1 of moving the portfolio out of `articles` and into its own tables.
 *
 * Copies every article in the `project` category into `projects`, its credits
 * into `project_members` and its translations into `project_translations`.
 *
 * It only ever creates. The articles are left exactly as they are and the site
 * keeps serving the portfolio from them, so running this changes nothing that
 * anyone can see: afterwards the data simply exists in both places. Phase 2
 * switches the reading over, and only then does phase 4 remove the old rows --
 * a separate, destructive step that is not this script's job.
 *
 *   npx tsx scripts/migrate-projects.ts            # dry run, writes nothing
 *   npx tsx scripts/migrate-projects.ts --apply
 *
 * Running it twice is safe: a project whose slug is already there is skipped,
 * not duplicated. `--force` re-copies those, replacing the project and with it
 * its members and translations, which cascade.
 *
 * The slug does not change. The English base slugs are already clean
 * (golfcraft, moneygrass, claimbite), and they become /portfolio/<slug>. The
 * per-language slugs of the translations are dropped on purpose: a project has
 * one address and the reader's language picks which translation fills it, which
 * is what the "golfcraft-4" suffixes were a symptom of.
 */

import { prisma } from '../src/db/index.js';
import { PORTFOLIO_CATEGORY } from '../src/constants/portfolio-seed.js';

const apply = process.argv.includes('--apply');
const force = process.argv.includes('--force');

/** Host and database name of the target, so it is obvious which one this is. */
function describeTarget(): string {
    try {
        const url = new URL(process.env.DATABASE_URL ?? '');
        return `${url.hostname}:${url.port || '5432'}${url.pathname}`;
    } catch {
        return '(DATABASE_URL unreadable)';
    }
}

async function main() {
    console.log('\n=== Portfolio: articles -> projects (phase 1, copy only) ===');
    console.log(`Mode:     ${apply ? 'APPLY' : 'DRY RUN (nothing is written)'}${force ? ' --force' : ''}`);
    console.log(`Database: ${describeTarget()}\n`);

    const articles = await prisma.article.findMany({
        where: { category: { name: { equals: PORTFOLIO_CATEGORY, mode: 'insensitive' } } },
        select: {
            id: true, slug: true, title: true, content: true, lang: true, sourceHash: true,
            thumbnail: true, screenshots: true, videoUrl: true,
            published: true, featured: true, createdAt: true, userId: true,
            tags: { select: { id: true, name: true } },
            credits: {
                select: { name: true, role: true, position: true, userId: true },
                orderBy: { position: 'asc' },
            },
            translations: {
                select: { targetLang: true, title: true, content: true, sourceHash: true, provider: true },
            },
        },
        orderBy: { id: 'asc' },
    });

    if (articles.length === 0) {
        console.log(`No articles in the "${PORTFOLIO_CATEGORY}" category. Nothing to move.`);
        return;
    }

    let copied = 0;
    let skipped = 0;
    const refused: string[] = [];

    for (const article of articles) {
        const existing = await prisma.project.findUnique({ where: { slug: article.slug }, select: { id: true } });

        console.log(`--- ${article.title} (article ${article.id} -> /portfolio/${article.slug}) ---`);

        if (existing && !force) {
            console.log(`  already copied as project ${existing.id}, skipping\n`);
            skipped++;
            continue;
        }

        // The two rules the new table enforces that the old one could not. A
        // project without a cover or without a single member is refused rather
        // than written half-formed: the point of the move is that those cannot
        // happen any more.
        const cover = (article.thumbnail ?? '').trim();
        if (cover === '') {
            console.log('  REFUSED: no cover, and projects.thumbnail is NOT NULL\n');
            refused.push(`${article.title}: no cover`);
            continue;
        }
        if (article.credits.length === 0) {
            console.log('  REFUSED: no credits, and a project needs at least one member\n');
            refused.push(`${article.title}: no members`);
            continue;
        }

        console.log(`  cover: ${cover}`);
        console.log(`  gallery: ${article.screenshots.length} screenshot(s)${article.videoUrl ? ', 1 video' : ''}`);
        console.log(`  tags: ${article.tags.map((t) => t.name).join(', ') || '(none)'}`);
        for (const credit of article.credits) {
            console.log(`  member: ${credit.name}${credit.role ? ` (${credit.role})` : ''}`
                + ` -> ${credit.userId ? `account ${credit.userId}` : 'name only, no account'}`);
        }
        console.log(`  translations: ${article.translations.map((t) => t.targetLang).join(', ') || '(none)'}`
            + ' (their per-language slugs are dropped)');
        console.log(`  ${article.published ? 'published' : 'draft'}${existing ? `, replacing project ${existing.id}` : ''}`);

        if (apply) {
            await prisma.$transaction(async (tx) => {
                // Deleting cascades to members and translations, so --force
                // rebuilds the whole thing rather than leaving leftovers.
                if (existing) await tx.project.delete({ where: { id: existing.id } });

                await tx.project.create({
                    data: {
                        slug: article.slug,
                        title: article.title,
                        content: article.content,
                        lang: article.lang,
                        sourceHash: article.sourceHash,
                        thumbnail: cover,
                        screenshots: article.screenshots,
                        videoUrl: article.videoUrl,
                        published: article.published,
                        featured: article.featured,
                        // Who entered it, not who made it. The article's author
                        // is whoever ran the old seed, which is exactly the lie
                        // this move exists to stop telling.
                        createdById: article.userId,
                        createdAt: article.createdAt,
                        tags: { connect: article.tags.map((tag) => ({ id: tag.id })) },
                        members: {
                            create: article.credits.map((credit, index) => ({
                                name: credit.name,
                                role: credit.role,
                                position: credit.position ?? index,
                                userId: credit.userId,
                            })),
                        },
                        translations: {
                            create: article.translations.map((translation) => ({
                                targetLang: translation.targetLang,
                                title: translation.title,
                                content: translation.content,
                                sourceHash: translation.sourceHash,
                                provider: translation.provider,
                            })),
                        },
                    },
                });
            });
        }

        copied++;
        console.log('');
    }

    console.log(`${copied} project(s) ${apply ? 'copied' : 'would be copied'}`
        + `${skipped > 0 ? `, ${skipped} already there` : ''}`
        + `${refused.length > 0 ? `, ${refused.length} refused` : ''}.`);

    if (refused.length > 0) {
        console.log('\nRefused:');
        for (const line of refused) console.log(`  ${line}`);
    }

    console.log(apply
        ? '\nThe articles are untouched and the site still reads from them. Nothing visible changed.\n'
        : '\nDry run. Re-run with --apply to copy them.\n');
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
