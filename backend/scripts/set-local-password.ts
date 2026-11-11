/**
 * Sets a user's password in the LOCAL development database.
 *
 * For getting back into localhost when nobody remembers the password, which
 * happens because the product has no reset flow yet.
 *
 *   cd backend && npx tsx scripts/set-local-password.ts
 *
 * Refuses to run against anything but localhost, so it can never be pointed at
 * production by accident. The password is typed in, never passed as an
 * argument, so it does not end up in the shell history.
 */
import argon2 from 'argon2';
import readline from 'readline';
import { Writable } from 'stream';
import { prisma } from '../src/db';

function assertLocalDatabase(): void {
    const url = process.env.DATABASE_URL ?? '';
    const host = url.match(/@([^:/?]+)/)?.[1] ?? '';
    if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
        console.error(`Refusing to run: DATABASE_URL points at "${host}", not a local database.`);
        process.exit(1);
    }
}

function ask(question: string, hidden = false): Promise<string> {
    let muted = false;
    const output = new Writable({
        write(chunk, _encoding, callback) {
            if (!muted) process.stdout.write(chunk);
            callback();
        },
    });

    const rl = readline.createInterface({ input: process.stdin, output, terminal: true });

    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            if (hidden) process.stdout.write('\n');
            rl.close();
            resolve(answer.trim());
        });
        muted = hidden;
    });
}

async function main(): Promise<void> {
    assertLocalDatabase();

    const users = await prisma.user.findMany({
        select: { id: true, email: true, role: true },
        orderBy: { id: 'asc' },
    });
    console.log('\nUsers in the local database:');
    for (const user of users) {
        console.log(`  ${String(user.id).padStart(3)}  ${user.email}  (${user.role})`);
    }

    const email = await ask('\nEmail: ');
    const target = users.find((user) => user.email === email);
    if (!target) {
        console.error('No user with that email in this database.');
        process.exit(1);
    }

    const password = await ask('New password (not shown): ', true);
    if (password.length < 6) {
        console.error('Too short: the sign-up form asks for at least 6 characters.');
        process.exit(1);
    }
    const again = await ask('Repeat it: ', true);
    if (password !== again) {
        console.error('They do not match.');
        process.exit(1);
    }

    await prisma.user.update({
        where: { id: target.id },
        data: { password: await argon2.hash(password), verified: true },
    });

    console.log(`\nDone. ${target.email} can sign in at http://localhost:5173/login\n`);
}

main()
    .catch((error) => {
        console.error('Failed:', error instanceof Error ? error.message : error);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
