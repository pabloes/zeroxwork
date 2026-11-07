/**
 * Gives a public handle to every account that still has none, so /member/<handle>
 * works for accounts created before handles existed.
 *
 * Uses the same ensureHandle() the site uses at registration, so there is one
 * rule and not two: a linked Discord name, else the account's default on-chain
 * name, else the automatic `member-<id>`. It never touches a handle that is
 * already set to something a member chose.
 *
 * Dry run by default. Nothing is written until --apply.
 *
 *   npx tsx scripts/backfill-handles.ts
 *   npx tsx scripts/backfill-handles.ts --apply
 *
 * Run it once on production after deploying. Re-running it is harmless.
 */

import { prisma } from '../src/db/index.js';
import { handleCandidates, isAutoHandle, resolvePublicName } from '../src/config/public-name.js';
import { ensureHandle } from '../src/services/public-handle.js';

const apply = process.argv.includes('--apply');

async function main() {
    const users = await prisma.user.findMany({
        select: {
            id: true,
            handle: true,
            displayName: true,
            verified: true,
            discordLink: { select: { globalName: true, username: true } },
            defaultName: { select: { name: true } },
        },
        orderBy: { id: 'asc' },
    });

    const pending = users.filter((user) => !user.handle || isAutoHandle(user.handle));

    console.log(`${users.length} accounts, ${pending.length} without a chosen handle.\n`);

    for (const user of pending) {
        const wanted = handleCandidates(user)[0];
        const name = resolvePublicName(user);
        const unverified = user.verified ? '' : '  (unverified: has a page, stays out of the directory)';

        if (user.handle === wanted) {
            console.log(`id=${user.id} @${user.handle} unchanged, nothing better available${unverified}`);
            continue;
        }

        if (!apply) {
            console.log(`id=${user.id} @${user.handle ?? '-'} -> @${wanted}   name: ${name}${unverified}`);
            continue;
        }

        const handle = await ensureHandle(user.id);
        console.log(`id=${user.id} @${user.handle ?? '-'} -> @${handle}   name: ${name}${unverified}`);
    }

    if (!apply) console.log('\nDry run. Re-run with --apply to write these handles.');
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
