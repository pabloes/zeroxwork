/**
 * Backfill: normalize all tag names to UPPERCASE and merge duplicates.
 *
 * Usage:
 *   npx tsx scripts/backfill-uppercase-tags.ts              # dry-run
 *   npx tsx scripts/backfill-uppercase-tags.ts --apply       # apply
 *
 * Safe to run multiple times (idempotent).
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const dryRun = !process.argv.includes('--apply');

async function main() {
    console.log(`\n=== Backfill: uppercase tags ===`);
    console.log(`Mode: ${dryRun ? 'DRY RUN' : 'APPLY'}\n`);

    const tags = await prisma.tag.findMany({ orderBy: { id: 'asc' } });

    // Group by normalized name
    const groups = new Map<string, typeof tags>();
    for (const tag of tags) {
        const normalized = tag.name.trim().toUpperCase();
        if (!groups.has(normalized)) groups.set(normalized, []);
        groups.get(normalized)!.push(tag);
    }

    let renamed = 0;
    let merged = 0;

    for (const [normalized, group] of groups) {
        if (group.length === 1) {
            const tag = group[0];
            if (tag.name === normalized) continue; // already correct
            console.log(`  RENAME: "${tag.name}" (id=${tag.id}) -> "${normalized}"`);
            if (!dryRun) {
                await prisma.tag.update({ where: { id: tag.id }, data: { name: normalized } });
            }
            renamed++;
        } else {
            // Merge: keep the lowest-id tag as canonical
            const canonical = group[0];
            const duplicates = group.slice(1);
            console.log(`  MERGE: "${normalized}" — keep id=${canonical.id}, merge ids=[${duplicates.map(d => d.id).join(',')}]`);

            for (const dup of duplicates) {
                // Get articles linked to the duplicate
                const dupWithArticles = await prisma.tag.findUnique({
                    where: { id: dup.id },
                    include: { articles: { select: { id: true } } },
                });

                if (dupWithArticles?.articles.length) {
                    // Get articles already linked to canonical to avoid duplicates
                    const canonicalWithArticles = await prisma.tag.findUnique({
                        where: { id: canonical.id },
                        include: { articles: { select: { id: true } } },
                    });
                    const existingIds = new Set(canonicalWithArticles?.articles.map(a => a.id) || []);
                    const toConnect = dupWithArticles.articles.filter(a => !existingIds.has(a.id));

                    if (toConnect.length) {
                        console.log(`    Move ${toConnect.length} article(s) from tag ${dup.id} to ${canonical.id}`);
                        if (!dryRun) {
                            await prisma.tag.update({
                                where: { id: canonical.id },
                                data: { articles: { connect: toConnect.map(a => ({ id: a.id })) } },
                            });
                        }
                    }
                }

                console.log(`    Delete duplicate tag id=${dup.id} ("${dup.name}")`);
                if (!dryRun) {
                    await prisma.tag.update({
                        where: { id: dup.id },
                        data: { articles: { set: [] } }, // disconnect all before delete
                    });
                    await prisma.tag.delete({ where: { id: dup.id } });
                }
            }

            // Rename canonical to normalized
            if (canonical.name !== normalized) {
                console.log(`    Rename canonical "${canonical.name}" -> "${normalized}"`);
                if (!dryRun) {
                    await prisma.tag.update({ where: { id: canonical.id }, data: { name: normalized } });
                }
            }
            merged++;
        }
    }

    console.log(`\n=== Summary ===`);
    console.log(`  Tags renamed: ${renamed}`);
    console.log(`  Tag groups merged: ${merged}`);

    if (dryRun && (renamed > 0 || merged > 0)) {
        console.log(`\nRun with --apply to execute.`);
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
