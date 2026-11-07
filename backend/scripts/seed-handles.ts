/**
 * Give members a public handle, derived only from what is already public.
 *
 * Usage:
 *   npx tsx scripts/seed-handles.ts            # dry-run, writes nothing
 *   npx tsx scripts/seed-handles.ts --apply    # set the handles
 *
 * The handle is the address of /member/<handle>, so it is published to anyone.
 * That rules out deriving it from the email: turning javier@gmail.com into the
 * handle "javier" would hand out a guessable address of a private mailbox. The
 * only public identity an account already carries is its Decentraland or Base
 * name, so that is the single source used here.
 *
 * Accounts without one are left alone and listed at the end, for their owner to
 * choose a handle in /account. Never overwrites a handle somebody already has,
 * and the first account to claim a name keeps it (oldest wins).
 */

import { PrismaClient } from '@prisma/client';
import { validateHandle } from '../src/config/profile';

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');

/** "pablo.dcl.eth" -> "pablo", "jgonzalezferrer.base.eth" -> "jgonzalezferrer" */
function handleFromName(walletName: string): string | null {
    const label = walletName.split('.')[0] ?? '';
    const candidate = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const checked = validateHandle(candidate);
    return checked.ok ? checked.value : null;
}

async function main() {
    const url = new URL(process.env.DATABASE_URL ?? '');
    console.log(`Base: ${url.hostname}:${url.port || 5432}${url.pathname}`);
    console.log(apply ? 'Modo: APLICAR\n' : 'Modo: simulacion (no escribe nada)\n');

    const users = await prisma.user.findMany({
        orderBy: { id: 'asc' },
        select: {
            id: true, email: true, handle: true, displayName: true, role: true,
            defaultName: { select: { name: true } },
            wallets: { select: { walletNames: { select: { name: true } } } },
        },
    });

    const taken = new Set(users.map((u) => u.handle).filter((h): h is string => h !== null));
    const planned: { id: number; handle: string; from: string }[] = [];
    const skipped: { id: number; email: string; why: string }[] = [];

    for (const user of users) {
        if (user.handle) {
            console.log(`id=${user.id}  ya tiene @${user.handle}, no se toca`);
            continue;
        }

        // The account's default name first, then any other name on its wallets.
        const names = [
            user.defaultName?.name,
            ...user.wallets.flatMap((w) => w.walletNames.map((n) => n.name)),
        ].filter((n): n is string => typeof n === 'string' && n !== '');

        const options = names
            .map((name) => ({ name, handle: handleFromName(name) }))
            .filter((o): o is { name: string; handle: string } => o.handle !== null && !taken.has(o.handle));

        // Several on-chain names on one wallet: prefer the one that agrees with
        // the account itself. Nothing private is published by this -- the name
        // was already public, the email only breaks the tie.
        const localPart = user.email.split('@')[0]?.toLowerCase().replace(/[^a-z0-9]+/g, '-') ?? '';
        const best = options.find((o) => o.handle === localPart) ?? options[0] ?? null;

        const chosen = best?.handle ?? null;
        const from = best?.name ?? '';

        if (!chosen) {
            skipped.push({
                id: user.id,
                email: user.email,
                why: names.length === 0
                    ? 'no tiene ningun nombre publico del que derivarlo'
                    : `sus nombres (${names.join(', ')}) ya estan cogidos o no son validos`,
            });
            continue;
        }

        taken.add(chosen);
        planned.push({ id: user.id, handle: chosen, from });
        const others = options.filter((o) => o.handle !== chosen).map((o) => `@${o.handle}`);
        console.log(`id=${user.id}  @${chosen}   <- ${from}${others.length ? `   (tambien podria ser ${others.join(', ')})` : ''}`);
    }

    if (apply) {
        for (const { id, handle } of planned) {
            await prisma.user.update({ where: { id }, data: { handle } });
        }
        console.log(`\n${planned.length} handle(s) escritos.`);
    } else {
        console.log(`\n${planned.length} handle(s) se escribirian. Relanza con --apply.`);
    }

    if (skipped.length > 0) {
        console.log('\nSin handle, lo elige su dueno en /account:');
        for (const s of skipped) console.log(`  id=${s.id}  ${s.email}  -- ${s.why}`);
    }
}

main()
    .catch((error) => { console.error(error); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
