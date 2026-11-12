/**
 * Junta varias cuentas de la misma persona en una sola.
 *
 * Uso:
 *   npx tsx scripts/merge-accounts.ts --keep 3 --drop 1,2,9           # simulacion
 *   npx tsx scripts/merge-accounts.ts --keep 3 --drop 1,2,9 --apply   # lo hace
 *
 * Mueve a la cuenta que se queda todo lo que cuelga de las otras y luego las
 * borra. El orden no es un detalle: `Article.userId` es `onDelete: Cascade`, asi
 * que borrar una cuenta con articulos se los lleva por delante. Aqui se mueven
 * primero y se borra despues, todo dentro de una transaccion, de modo que si
 * algo falla a mitad no queda nada a medias.
 *
 * La simulacion no es una maqueta de lo que pasaria: ejecuta las mismas
 * escrituras contra la base de datos real, con sus indices y sus claves ajenas,
 * y deshace la transaccion al final. Lo que imprime ya ha ocurrido de verdad
 * una vez. Si un indice unico fuera a saltar, salta en la simulacion.
 *
 * Lo que NO hace, a proposito: tocar el correo, el handle, el nombre, el rol o
 * la contrasena de la cuenta que se queda. Eso se cambia antes en /admin, donde
 * puedes comprobar que entras con ella ANTES de que desaparezcan las demas.
 * Un script que te renombra la cuenta y te borra la vieja en el mismo segundo
 * es un script que te puede dejar fuera.
 */

import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');

/** Marca para deshacer la transaccion cuando esto es una simulacion. */
class DryRun extends Error {}

function numberList(flag: string): number[] {
    const index = process.argv.indexOf(flag);
    if (index === -1 || !process.argv[index + 1]) return [];
    return process.argv[index + 1]
        .split(',')
        .map((part) => Number(part.trim()))
        .filter((n) => Number.isInteger(n) && n > 0);
}

/** Todo lo que cuelga de una cuenta, para contarlo antes y despues. */
async function inventory(tx: Prisma.TransactionClient, userId: number) {
    const articles = await tx.article.count({ where: { userId } });
    const credits = await tx.articleCredit.count({ where: { userId } });
    const projects = await tx.project.count({ where: { createdById: userId } });
    const projectRoles = await tx.projectMember.count({ where: { userId } });
    const uploads = await tx.fileUpload.count({ where: { userId } });
    const apiKeys = await tx.apiKey.count({ where: { userId } });
    const wallets = await tx.wallet.count({ where: { userId } });
    const socials = await tx.userSocial.count({ where: { userId } });
    const discordLinks = await tx.discordLink.count({ where: { userId } });
    const discordRoles = await tx.discordRoleGrant.count({ where: { userId } });

    return {
        articles, credits, projects, projectRoles, uploads,
        apiKeys, wallets, socials, discordLinks, discordRoles,
        total: articles + credits + projects + projectRoles + uploads
            + apiKeys + wallets + socials + discordLinks + discordRoles,
    };
}

function describe(label: string, counts: Awaited<ReturnType<typeof inventory>>): void {
    const parts = [
        counts.articles && `${counts.articles} articulos`,
        counts.credits && `${counts.credits} creditos de articulo`,
        counts.projects && `${counts.projects} proyectos dados de alta`,
        counts.projectRoles && `${counts.projectRoles} creditos de proyecto`,
        counts.uploads && `${counts.uploads} ficheros subidos`,
        counts.apiKeys && `${counts.apiKeys} claves API`,
        counts.wallets && `${counts.wallets} carteras`,
        counts.socials && `${counts.socials} redes`,
        counts.discordLinks && `${counts.discordLinks} enlace de Discord`,
        counts.discordRoles && `${counts.discordRoles} roles de Discord`,
    ].filter(Boolean);

    console.log(`${label}: ${parts.length ? parts.join(', ') : 'nada'}`);
}

async function main(): Promise<void> {
    const url = new URL(process.env.DATABASE_URL ?? '');
    console.log(`Base: ${url.hostname}:${url.port || 5432}${url.pathname}`);
    console.log(apply ? 'Modo: APLICAR\n' : 'Modo: simulacion (deshace al final)\n');

    const keep = numberList('--keep')[0];
    const drop = numberList('--drop');

    if (!keep || drop.length === 0) {
        console.error('Faltan argumentos: --keep <id> --drop <id,id,...>');
        process.exit(1);
    }
    if (drop.includes(keep)) {
        console.error(`La cuenta ${keep} esta en --keep y en --drop a la vez.`);
        process.exit(1);
    }

    const users = await prisma.user.findMany({
        where: { id: { in: [keep, ...drop] } },
        select: { id: true, email: true, handle: true, displayName: true, role: true, defaultNameId: true },
    });

    const missing = [keep, ...drop].filter((id) => !users.some((u) => u.id === id));
    if (missing.length > 0) {
        console.error(`No existen estas cuentas: ${missing.join(', ')}`);
        process.exit(1);
    }

    const keeper = users.find((u) => u.id === keep)!;

    // La trampa de esta operacion: borrar al unico administrador. Si el rol
    // viaja en las cuentas que se van y no esta en la que se queda, al terminar
    // no habria con quien entrar en /admin, y no hay forma de recuperarlo desde
    // la web. Se pone el rol antes, a mano, y se comprueba que se entra.
    const losingAdmins = users.filter((u) => drop.includes(u.id) && u.role === 'ADMIN');
    if (losingAdmins.length > 0 && keeper.role !== 'ADMIN') {
        console.error(`La cuenta ${keep} no es ADMIN y si lo es la ${losingAdmins.map((u) => u.id).join(', ')}.`);
        console.error('Dale ADMIN en /admin a la que se queda, comprueba que entras con ella, y vuelve.');
        process.exit(1);
    }

    console.log('Antes:');
    for (const user of users) {
        const counts = await inventory(prisma, user.id);
        const mark = user.id === keep ? '  SE QUEDA  ' : '  se borra  ';
        describe(`${mark}id=${user.id} @${user.handle ?? '-'} <${user.email}> ${user.role}`, counts);
    }
    console.log();

    try {
        await prisma.$transaction(async (tx) => {
            const moved: string[] = [];
            const where = { userId: { in: drop } };

            // Lo que se mueve sin estorbarse: ninguna de estas tablas tiene un
            // indice unico sobre userId, asi que dos filas de dos cuentas
            // distintas conviven en la que se queda. Se piden de una en una: en
            // una transaccion interactiva las consultas van por el mismo hilo,
            // y lanzarlas todas a la vez solo sirve para pisarse.
            const simple: [string, () => Promise<{ count: number }>][] = [
                ['articulos', () => tx.article.updateMany({ where, data: { userId: keep } })],
                ['creditos de articulo', () => tx.articleCredit.updateMany({ where, data: { userId: keep } })],
                ['proyectos dados de alta', () => tx.project.updateMany({ where: { createdById: { in: drop } }, data: { createdById: keep } })],
                ['creditos de proyecto', () => tx.projectMember.updateMany({ where, data: { userId: keep } })],
                ['ficheros subidos', () => tx.fileUpload.updateMany({ where, data: { userId: keep } })],
                ['claves API', () => tx.apiKey.updateMany({ where, data: { userId: keep } })],
                ['carteras', () => tx.wallet.updateMany({ where, data: { userId: keep } })],
            ];

            for (const [label, run] of simple) {
                const { count } = await run();
                if (count > 0) moved.push(`${count} ${label}`);
            }

            // Redes sociales: unica por (userId, network). La que se queda
            // manda; de las otras solo viajan las redes que le falten, y la
            // primera que llegue se queda con el hueco.
            const keeperNetworks = new Set(
                (await tx.userSocial.findMany({ where: { userId: keep }, select: { network: true } }))
                    .map((s) => s.network),
            );
            let socialsMoved = 0;
            let socialsDropped = 0;
            for (const social of await tx.userSocial.findMany({ where, orderBy: { id: 'asc' } })) {
                if (keeperNetworks.has(social.network)) {
                    await tx.userSocial.delete({ where: { id: social.id } });
                    socialsDropped += 1;
                    continue;
                }
                await tx.userSocial.update({ where: { id: social.id }, data: { userId: keep } });
                keeperNetworks.add(social.network);
                socialsMoved += 1;
            }
            if (socialsMoved > 0) moved.push(`${socialsMoved} redes`);
            if (socialsDropped > 0) console.log(`  (${socialsDropped} redes repetidas, se quedan las de la cuenta que sobrevive)`);

            // Enlace de Discord: uno por cuenta, y la cuenta de Discord es una
            // sola persona. Si la que se queda ya tiene el suyo, los demas
            // sobran; si no tiene, hereda el primero.
            const keeperDiscord = await tx.discordLink.findUnique({ where: { userId: keep } });
            const otherDiscord = await tx.discordLink.findMany({ where, orderBy: { id: 'asc' } });
            if (otherDiscord.length > 0) {
                const [first, ...rest] = otherDiscord;
                const leftovers = keeperDiscord ? otherDiscord : rest;
                if (!keeperDiscord) {
                    await tx.discordLink.update({ where: { id: first.id }, data: { userId: keep } });
                    moved.push('1 enlace de Discord');
                }
                for (const link of leftovers) {
                    await tx.discordLink.delete({ where: { id: link.id } });
                }
                if (leftovers.length > 0) console.log(`  (${leftovers.length} enlaces de Discord sobrantes, borrados)`);
            }

            // Roles de Discord: unico por (userId, roleKey), mismo criterio.
            const keeperRoles = new Set(
                (await tx.discordRoleGrant.findMany({ where: { userId: keep }, select: { roleKey: true } }))
                    .map((g) => g.roleKey),
            );
            let rolesMoved = 0;
            for (const grant of await tx.discordRoleGrant.findMany({ where, orderBy: { id: 'asc' } })) {
                if (keeperRoles.has(grant.roleKey)) {
                    await tx.discordRoleGrant.delete({ where: { id: grant.id } });
                    continue;
                }
                await tx.discordRoleGrant.update({ where: { id: grant.id }, data: { userId: keep } });
                keeperRoles.add(grant.roleKey);
                rolesMoved += 1;
            }
            if (rolesMoved > 0) moved.push(`${rolesMoved} roles de Discord`);

            // El nombre on-chain por defecto es una relacion uno a uno sobre
            // users.defaultNameId: hay que soltarlo en la cuenta vieja antes de
            // ponerlo en la nueva, o el indice unico lo impide.
            if (keeper.defaultNameId === null) {
                const donor = users.find((u) => drop.includes(u.id) && u.defaultNameId !== null);
                if (donor) {
                    await tx.user.update({ where: { id: donor.id }, data: { defaultNameId: null } });
                    await tx.user.update({ where: { id: keep }, data: { defaultNameId: donor.defaultNameId } });
                    moved.push('el nombre por defecto');
                }
            }

            console.log(`Movido a id=${keep}: ${moved.length ? moved.join(', ') : 'nada'}`);

            // Nadie se borra con algo encima. Si esto salta, hay una tabla que
            // este script no conoce y la transaccion se deshace entera.
            for (const id of drop) {
                const left = await inventory(tx, id);
                if (left.total > 0) {
                    describe(`  id=${id} todavia tiene`, left);
                    throw new Error(`La cuenta ${id} no esta vacia: no se borra nada.`);
                }
            }

            const { count } = await tx.user.deleteMany({ where: { id: { in: drop } } });
            console.log(`Borradas ${count} cuentas: ${drop.join(', ')}`);

            const after = await inventory(tx, keep);
            console.log();
            describe(`Despues  id=${keep} @${keeper.handle ?? '-'} <${keeper.email}>`, after);

            // Dos creditos de la misma persona en el mismo sitio: no lo impide
            // ningun indice, porque el unico es por nombre, no por cuenta.
            const duplicates = await tx.projectMember.groupBy({
                by: ['projectId'],
                where: { userId: keep },
                _count: { projectId: true },
                having: { projectId: { _count: { gt: 1 } } },
            });
            if (duplicates.length > 0) {
                console.log(`\nAviso: apareces dos veces en ${duplicates.length} proyecto(s) (ids ${duplicates.map((d) => d.projectId).join(', ')}).`);
                console.log('Eran creditos a nombres distintos de dos cuentas tuyas. Quita el que sobre en /admin.');
            }

            if (!apply) throw new DryRun();
        }, { timeout: 120_000, maxWait: 20_000 });
    } catch (error) {
        if (error instanceof DryRun) {
            console.log('\nSimulacion: deshecho. Nada de lo anterior se ha guardado.');
            console.log('Repite con --apply cuando tengas copia de seguridad.');
            return;
        }
        throw error;
    }

    console.log('\nHecho.');
    console.log('Comprueba que entras con la cuenta que queda antes de cerrar la sesion.');
}

main()
    .catch((error) => {
        console.error('\nNo se ha cambiado nada:', error instanceof Error ? error.message : error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
