/**
 * Backfill migration: convert legacy article `script` fields to `embedUrl`/`embedHeight`.
 *
 * What it does:
 * 1. Finds all articles where `script` is not null/empty
 * 2. Tries to extract an iframe URL from the script content
 * 3. Sets `embedUrl` and `embedHeight` on the article
 * 4. Adds `[iframe]` placeholder to article content if not already present
 * 5. Clears the `script` field
 *
 * Usage:
 *   npx tsx scripts/backfill-embed-from-script.ts              # dry-run (default)
 *   npx tsx scripts/backfill-embed-from-script.ts --apply       # actually apply changes
 *
 * The script is idempotent — running it multiple times is safe.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const dryRun = !process.argv.includes('--apply');

// ==================== KNOWN MIGRATIONS ====================
// Explicit mappings for known legacy scripts.
// These take priority over heuristic extraction.

interface KnownMigration {
    embedUrl: string;
    embedHeight: number;
}

const KNOWN_MIGRATIONS: { pattern: string; migration: KnownMigration }[] = [
    {
        pattern: 'pabloes.github.io/aave-vault-dapp',
        migration: {
            embedUrl: 'https://pabloes.github.io/aave-vault-dapp/',
            embedHeight: 1000,
        },
    },
];

/**
 * Check if script matches a known legacy case.
 * Returns the deterministic migration if found, null otherwise.
 */
function matchKnownMigration(script: string): KnownMigration | null {
    for (const { pattern, migration } of KNOWN_MIGRATIONS) {
        if (script.includes(pattern)) {
            return migration;
        }
    }
    return null;
}

// ==================== HEURISTIC EXTRACTION ====================

/**
 * Try to extract an iframe src URL from a script that creates an iframe.
 * Fallback for scripts that don't match any known migration.
 */
function extractIframeUrl(script: string): string | null {
    const srcAssign = script.match(/\.src\s*=\s*['"]([^'"]+)['"]/);
    if (srcAssign) return srcAssign[1];

    const setAttr = script.match(/setAttribute\s*\(\s*['"]src['"]\s*,\s*['"]([^'"]+)['"]\s*\)/);
    if (setAttr) return setAttr[1];

    const urlMatch = script.match(/(https?:\/\/[^\s'"<>]+)/);
    if (urlMatch) return urlMatch[1];

    return null;
}

function extractIframeHeight(script: string): number | null {
    const heightAssign = script.match(/\.height\s*=\s*['"]?(\d+)['"]?/);
    if (heightAssign) return parseInt(heightAssign[1], 10);

    const styleHeight = script.match(/style\.height\s*=\s*['"](\d+)px['"]/);
    if (styleHeight) return parseInt(styleHeight[1], 10);

    return null;
}

async function main() {
    console.log(`\n=== Backfill: script -> embedUrl/embedHeight ===`);
    console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'APPLY (changes will be written to DB)'}\n`);

    // Find articles with non-empty script
    const articles = await prisma.article.findMany({
        where: {
            script: { not: null },
        },
        select: {
            id: true,
            title: true,
            script: true,
            content: true,
            embedUrl: true,
        },
    });

    // Filter out empty scripts
    const withScript = articles.filter(a => a.script && a.script.trim().length > 0);

    if (withScript.length === 0) {
        console.log('No articles with legacy script found. Nothing to migrate.');
        return;
    }

    console.log(`Found ${withScript.length} article(s) with legacy script:\n`);

    let migrated = 0;
    let skipped = 0;
    let failed = 0;

    for (const article of withScript) {
        console.log(`--- Article #${article.id}: "${article.title}" ---`);
        console.log(`  Script (first 200 chars): ${article.script!.substring(0, 200)}`);

        // Skip if already has embedUrl
        if (article.embedUrl) {
            console.log(`  SKIP: already has embedUrl="${article.embedUrl}"`);
            skipped++;
            continue;
        }

        // Step 1: Try known explicit migrations first
        const known = matchKnownMigration(article.script!);
        let finalUrl: string;
        let finalHeight: number;

        if (known) {
            finalUrl = known.embedUrl;
            finalHeight = known.embedHeight;
            console.log(`  KNOWN CASE matched -> embedUrl="${finalUrl}", embedHeight=${finalHeight}`);
        } else {
            // Step 2: Fallback to heuristic extraction
            const extractedUrl = extractIframeUrl(article.script!);
            const extractedHeight = extractIframeHeight(article.script!);

            if (!extractedUrl) {
                console.log(`  FAIL: could not extract iframe URL from script`);
                console.log(`  ACTION NEEDED: manually review this article and set embedUrl`);
                failed++;
                continue;
            }

            finalUrl = extractedUrl;
            finalHeight = extractedHeight || 600;
            console.log(`  HEURISTIC extraction -> embedUrl="${finalUrl}", embedHeight=${finalHeight}`);
            console.log(`  WARNING: heuristic result — verify this URL is correct and whitelisted`);
        }

        // Step 3: Add [iframe] placeholder if not present
        const needsPlaceholder = !article.content.includes('[iframe]');
        const newContent = needsPlaceholder
            ? article.content + '\n\n[iframe]'
            : article.content;

        if (needsPlaceholder) {
            console.log(`  Adding [iframe] placeholder to end of content`);
        }

        if (!dryRun) {
            await prisma.article.update({
                where: { id: article.id },
                data: {
                    embedUrl: finalUrl,
                    embedHeight: finalHeight,
                    content: newContent,
                    script: null,
                },
            });
            console.log(`  MIGRATED successfully`);
        } else {
            console.log(`  WOULD MIGRATE (dry-run)`);
        }

        migrated++;
    }

    console.log(`\n=== Summary ===`);
    console.log(`  Total with script: ${withScript.length}`);
    console.log(`  Migrated: ${migrated}`);
    console.log(`  Skipped (already has embedUrl): ${skipped}`);
    console.log(`  Failed (needs manual review): ${failed}`);

    if (dryRun && migrated > 0) {
        console.log(`\nRun with --apply to execute the migration.`);
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
