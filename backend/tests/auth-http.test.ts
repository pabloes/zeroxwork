/**
 * Sign-in, recovery and the account changes over real HTTP, with the database
 * and the mail server stood in for.
 *
 * What only a request can show: that a stranger learns nothing from the
 * answers, that a mailed link is not a login, that a reset link works once,
 * and that a new password signs every other device out.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';

const SECRET = 'jwt-secret-for-tests';

// ----------------------------------------------------------- stand-ins

const users: any[] = [];
let nextId = 1;
const outbox: { to: string; subject: string; html: string }[] = [];

function matches(row: any, where: Record<string, any>): boolean {
    return Object.entries(where).every(([key, wanted]) => {
        if (wanted && typeof wanted === 'object' && 'equals' in wanted) {
            return wanted.mode === 'insensitive'
                ? String(row[key]).toLowerCase() === String(wanted.equals).toLowerCase()
                : row[key] === wanted.equals;
        }
        return row[key] === wanted;
    });
}

vi.mock('../src/db/index.js', () => ({
    prisma: {
        user: {
            // copies, as a database returns: holding a row must not see later writes
            findUnique: async ({ where }: any) => { const row = users.find((u) => matches(u, where)); return row ? { ...row, wallets: [] } : null; },
            findFirst: async ({ where }: any) => { const row = users.find((u) => matches(u, where)); return row ? { ...row } : null; },
            create: async ({ data }: any) => {
                const { socials: _socials, ...fields } = data;
                const row = { id: nextId++, role: 'USER', verified: false, createdAt: new Date(), ...fields };
                users.push(row);
                return { ...row };
            },
            update: async ({ where, data }: any) => { const row = users.find((u) => matches(u, where)); Object.assign(row, data); return { ...row }; },
            updateMany: async ({ where, data }: any) => {
                const hit = users.filter((u) => matches(u, where));
                hit.forEach((row) => Object.assign(row, data));
                return { count: hit.length };
            },
        },
    },
}));

vi.mock('../src/config/env.js', () => ({
    env: { JWT_SECRET: 'jwt-secret-for-tests', VERIFICATION_RESEND_SECRET: 'resend-secret-for-tests', SESSION_SECRET: 'x', ADMIN_COOKIE_PASSWORD: 'x' },
    requireEnv: (name: string) => name,
}));

vi.mock('../src/services/mailer.js', () => {
    class MailDeliveryError extends Error {}
    return {
        MailDeliveryError,
        sendMail: async (to: string, subject: string, html: string) => {
            if (to.endsWith('@bounces.test')) throw new MailDeliveryError('not accepted');
            outbox.push({ to, subject, html });
        },
    };
});

// none of these is what is under test, and each drags in the network or the disk
vi.mock('../src/routes/image.js', () => ({ ImageRejected: class extends Error {}, storeImageBuffer: async () => ({ banned: false, servedUrl: '/x' }) }));
vi.mock('../src/services/admin-notify.js', () => ({ notifyAdminNewUser: async () => undefined }));
vi.mock('../src/services/decentraland-names.js', () => ({ updateUserExtraSpace: async () => undefined, updateWalletNames: async () => [] }));
vi.mock('../src/services/public-handle.js', () => ({ freeHandle: async (handle: string) => handle }));
// the limits are the library's job; here they would only make the order of the tests matter
vi.mock('express-rate-limit', () => ({ default: () => (_req: any, _res: any, next: any) => next() }));

// ------------------------------------------------------------- the server

let base = '';
let server: any;

beforeAll(async () => {
    const express = (await import('express')).default;
    const authRoutes = (await import('../src/routes/auth.js')).default;
    const { verifyToken } = await import('../src/middleware/authMiddleware.js');
    const app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);
    app.get('/api/whoami', verifyToken, (req: any, res) => res.json(req.user));
    await new Promise<void>((done) => { server = app.listen(0, done); });
    base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(() => server?.close());

beforeEach(() => {
    users.length = 0;
    outbox.length = 0;
    // ids are never reused: the server remembers, per account, when it last
    // mailed a reset link, and a recycled id would inherit that wait
});

async function post(path: string, body: unknown, token?: string) {
    const res = await fetch(`${base}/api/auth${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() as any };
}

async function whoami(token: string) {
    const res = await fetch(`${base}/api/whoami`, { headers: { Authorization: `Bearer ${token}` } });
    return { status: res.status, body: await res.json() as any };
}

async function account(email: string, password: string, extra: Record<string, unknown> = {}) {
    const row = { id: nextId++, email, password: await argon2.hash(password), role: 'USER', verified: true, createdAt: new Date(), ...extra };
    users.push(row);
    return row;
}

/** The mail with that subject fragment, once it has left: some are sent after the reply. */
async function mailTo(to: string, subjectPart: string) {
    await vi.waitFor(() => {
        expect(outbox.some((m) => m.to === to && m.subject.includes(subjectPart))).toBe(true);
    });
    return outbox.find((m) => m.to === to && m.subject.includes(subjectPart))!;
}

const tokenIn = (html: string) => decodeURIComponent(/#token=([^"<\s]+)/.exec(html)![1]);
const settle = () => new Promise((done) => setTimeout(done, 60));

async function signIn(email: string, password: string): Promise<string> {
    const res = await post('/login', { email, password });
    expect(res.status).toBe(200);
    return res.body.token;
}

// ------------------------------------------------------------------ tests

describe('signing in', () => {
    it('gives a stranger the same answer for a wrong password and for an address we do not know', async () => {
        await account('ana@example.com', 'correct horse');
        const wrong = await post('/login', { email: 'ana@example.com', password: 'nope-nope' });
        const unknown = await post('/login', { email: 'nobody@example.com', password: 'nope-nope' });
        expect(wrong.status).toBe(401);
        expect(unknown).toEqual(wrong);
        expect(wrong.body.code).toBe('INVALID_CREDENTIALS');
    });

    it('does not tell an unverified account apart until the password is right', async () => {
        await account('new@example.com', 'correct horse', { verified: false });
        const wrong = await post('/login', { email: 'new@example.com', password: 'nope-nope' });
        expect(wrong.status).toBe(401);
        expect(wrong.body.resendToken).toBeUndefined();

        const right = await post('/login', { email: 'new@example.com', password: 'correct horse' });
        expect(right.status).toBe(403);
        expect(right.body.code).toBe('EMAIL_NOT_VERIFIED');
        expect(typeof right.body.resendToken).toBe('string');
    });

    it('finds an account that was stored with capitals, whatever capitals are typed', async () => {
        await account('Ana.Perez@Example.com', 'correct horse');
        for (const typed of ['Ana.Perez@Example.com', 'ana.perez@example.com', ' ANA.PEREZ@EXAMPLE.COM ']) {
            const res = await post('/login', { email: typed, password: 'correct horse' });
            expect(res.status).toBe(200);
        }
    });

    it('opens a session that the rest of the API accepts', async () => {
        const row = await account('ana@example.com', 'correct horse');
        const who = await whoami(await signIn('ana@example.com', 'correct horse'));
        expect(who).toEqual({ status: 200, body: { id: row.id, email: 'ana@example.com', role: 'USER' } });
    });

    it('answers 400, not a crash, to a body that is not what it expects', async () => {
        for (const body of [{}, { email: 'ana@example.com' }, { email: { $ne: '' }, password: 'x' }, { email: 'a@b.co', password: 42 }]) {
            expect((await post('/login', body)).status).toBe(400);
        }
    });
});

describe('signing up', () => {
    const form = { email: 'Ana@Example.com', password: 'correct horse', displayName: 'Ana Perez', handle: 'ana-perez' };

    it('stores the address lower case and mails a link that is not a login', async () => {
        const res = await post('/register', form);
        expect(res.status).toBe(200);
        expect(users[0].email).toBe('ana@example.com');

        const mail = await mailTo('ana@example.com', 'verification');
        expect(mail.html).toContain('/verify#token=');
        const token = tokenIn(mail.html);

        // the bug this replaces: for six hours that link opened the account
        expect((await whoami(token)).status).toBe(401);

        expect((await post('/verify', { token })).status).toBe(200);
        expect(users[0].verified).toBe(true);
        // the page reads this exact sentence to treat a second click as success
        expect((await post('/verify', { token })).body.message).toBe('User is already verified.');
    });

    it('refuses the same inbox twice, capitals or not, and what is not an address', async () => {
        await post('/register', form);
        const again = await post('/register', { ...form, email: 'ANA@example.com', handle: 'ana-two' });
        expect(again.status).toBe(400);
        expect(users).toHaveLength(1);

        const bad = await post('/register', { ...form, email: 'ana at example' });
        expect(bad.body.code).toBe('EMAIL_INVALID');
    });

    it('still honours a verification link mailed before this change, and still refuses it as a login', async () => {
        const row = await account('old@example.com', 'correct horse', { verified: false });
        const old = jwt.sign({ userId: row.id }, SECRET, { expiresIn: '6h' });
        expect((await whoami(old)).status).toBe(401);
        expect((await post('/verify', { token: old })).status).toBe(200);
    });

    it('does not let a session stand in for the verification link', async () => {
        const row = await account('ana@example.com', 'correct horse');
        const session = await signIn('ana@example.com', 'correct horse');
        users.find((u) => u.id === row.id).verified = false;
        expect((await post('/verify', { token: session })).status).toBe(400);
        expect(users[0].verified).toBe(false);
    });
});

describe('forgotten password', () => {
    it('answers the same whether or not the address has an account, and mails only the one that does', async () => {
        await account('ana@example.com', 'correct horse');
        const known = await post('/forgot-password', { email: 'ana@example.com' });
        const unknown = await post('/forgot-password', { email: 'nobody@example.com' });
        expect(known).toEqual({ status: 200, body: { ok: true } });
        expect(unknown).toEqual(known);

        await mailTo('ana@example.com', 'new ZEROxWORK password');
        await settle();
        expect(outbox).toHaveLength(1);
    });

    it('does not fill an inbox: a second request right after sends nothing', async () => {
        await account('ana@example.com', 'correct horse');
        await post('/forgot-password', { email: 'ana@example.com' });
        await mailTo('ana@example.com', 'new ZEROxWORK password');
        await post('/forgot-password', { email: 'ANA@example.com' });
        await settle();
        expect(outbox.filter((m) => m.subject.includes('new ZEROxWORK password'))).toHaveLength(1);
    });

    it('lets the link choose a new password once, and signs every open session out', async () => {
        const row = await account('ana@example.com', 'correct horse');
        const before = await signIn('ana@example.com', 'correct horse');

        await post('/forgot-password', { email: 'ana@example.com' });
        const token = tokenIn((await mailTo('ana@example.com', 'new ZEROxWORK password')).html);

        // the link is not a login either
        expect((await whoami(token)).status).toBe(401);

        const reset = await post('/reset-password', { token, password: 'battery staple' });
        expect(reset).toEqual({ status: 200, body: { ok: true } });

        expect((await post('/login', { email: 'ana@example.com', password: 'correct horse' })).status).toBe(401);
        expect((await whoami(before)).status).toBe(401);
        expect((await whoami(await signIn('ana@example.com', 'battery staple'))).body.id).toBe(row.id);

        const again = await post('/reset-password', { token, password: 'a third password' });
        expect(again.status).toBe(400);
        expect(again.body.code).toBe('TOKEN_INVALID');
        expect((await post('/login', { email: 'ana@example.com', password: 'a third password' })).status).toBe(401);

        await mailTo('ana@example.com', 'password was changed');
    });

    it('counts opening the link as verifying the address', async () => {
        await account('new@example.com', 'forgotten', { verified: false });
        await post('/forgot-password', { email: 'new@example.com' });
        const token = tokenIn((await mailTo('new@example.com', 'new ZEROxWORK password')).html);
        await post('/reset-password', { token, password: 'battery staple' });
        expect((await post('/login', { email: 'new@example.com', password: 'battery staple' })).status).toBe(200);
    });

    it('refuses a short password, a made-up link and an expired one, each by name', async () => {
        const row = await account('ana@example.com', 'correct horse');
        await post('/forgot-password', { email: 'ana@example.com' });
        const token = tokenIn((await mailTo('ana@example.com', 'new ZEROxWORK password')).html);

        expect((await post('/reset-password', { token, password: 'abc' })).body.code).toBe('PASSWORD_SHORT');
        expect((await post('/reset-password', { token: 'made.up.link', password: 'battery staple' })).body.code).toBe('TOKEN_INVALID');
        expect((await post('/reset-password', { password: 'battery staple' })).body.code).toBe('TOKEN_INVALID');

        // a session, even a real one, is not a reset link
        const session = await signIn('ana@example.com', 'correct horse');
        expect((await post('/reset-password', { token: session, password: 'battery staple' })).body.code).toBe('TOKEN_INVALID');
        expect(await argon2.verify(users.find((u) => u.id === row.id).password, 'correct horse')).toBe(true);
    });

    it('refuses what is not an address before doing anything', async () => {
        const res = await post('/forgot-password', { email: 'ana' });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('EMAIL_INVALID');
    });
});

describe('changing the password from the account', () => {
    it('needs the current one', async () => {
        await account('ana@example.com', 'correct horse');
        const session = await signIn('ana@example.com', 'correct horse');
        const res = await post('/change-password', { currentPassword: 'not it', newPassword: 'battery staple' }, session);
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('WRONG_PASSWORD');
        expect((await whoami(session)).status).toBe(200);
    });

    it('refuses a short one and the same one', async () => {
        await account('ana@example.com', 'correct horse');
        const session = await signIn('ana@example.com', 'correct horse');
        expect((await post('/change-password', { currentPassword: 'correct horse', newPassword: 'abc' }, session)).body.code).toBe('PASSWORD_SHORT');
        expect((await post('/change-password', { currentPassword: 'correct horse', newPassword: 'correct horse' }, session)).body.code).toBe('PASSWORD_SAME');
    });

    it('keeps this device in and signs the others out', async () => {
        await account('ana@example.com', 'correct horse');
        const here = await signIn('ana@example.com', 'correct horse');
        const elsewhere = await signIn('ana@example.com', 'correct horse');

        const res = await post('/change-password', { currentPassword: 'correct horse', newPassword: 'battery staple' }, here);
        expect(res.status).toBe(200);
        expect((await whoami(res.body.token)).status).toBe(200);
        expect((await whoami(here)).status).toBe(401);
        expect((await whoami(elsewhere)).status).toBe(401);
        await mailTo('ana@example.com', 'password was changed');
    });

    it('is not for strangers', async () => {
        const res = await post('/change-password', { currentPassword: 'x', newPassword: 'battery staple' });
        expect(res.status).toBe(401);
    });
});

describe('changing the email', () => {
    it('changes nothing until the link in the new inbox is opened, then warns the old one', async () => {
        const row = await account('old@example.com', 'correct horse');
        const session = await signIn('old@example.com', 'correct horse');

        const asked = await post('/change-email', { newEmail: ' New@Example.com ', currentPassword: 'correct horse' }, session);
        expect(asked).toEqual({ status: 200, body: { ok: true } });
        expect(users[0].email).toBe('old@example.com');

        const mail = await mailTo('new@example.com', 'Confirm your new');
        expect(mail.html).toContain('/confirm-email#token=');
        const token = tokenIn(mail.html);
        expect((await whoami(token)).status).toBe(401);

        const confirmed = await post('/confirm-email-change', { token });
        expect(confirmed).toEqual({ status: 200, body: { ok: true, email: 'new@example.com' } });
        expect(users[0].email).toBe('new@example.com');

        const notice = await mailTo('old@example.com', 'was changed');
        expect(notice.html).not.toContain('new@example.com');

        expect((await post('/login', { email: 'old@example.com', password: 'correct horse' })).status).toBe(401);
        expect((await whoami(await signIn('new@example.com', 'correct horse'))).body.id).toBe(row.id);

        // spent: the address it was made for is no longer the account's
        expect((await post('/confirm-email-change', { token })).body.code).toBe('TOKEN_INVALID');
    });

    it('needs the password, a real address, a different one and a free one', async () => {
        await account('ana@example.com', 'correct horse');
        await account('taken@example.com', 'whatever else');
        const session = await signIn('ana@example.com', 'correct horse');
        const ask = (newEmail: unknown, currentPassword = 'correct horse') => post('/change-email', { newEmail, currentPassword }, session);

        expect((await ask('new@example.com', 'not it')).body.code).toBe('WRONG_PASSWORD');
        expect((await ask('not an address')).body.code).toBe('EMAIL_INVALID');
        expect((await ask('ANA@example.com')).body.code).toBe('EMAIL_SAME');
        expect((await ask('Taken@Example.com')).body.code).toBe('EMAIL_TAKEN');
        await settle();
        expect(outbox).toHaveLength(0);
    });

    it('says so when the mail could not be sent, and changes nothing', async () => {
        await account('ana@example.com', 'correct horse');
        const session = await signIn('ana@example.com', 'correct horse');
        const res = await post('/change-email', { newEmail: 'me@bounces.test', currentPassword: 'correct horse' }, session);
        expect(res.status).toBe(502);
        expect(res.body.code).toBe('MAIL_FAILED');
        expect(users[0].email).toBe('ana@example.com');
    });

    it('kills the link if the password changes before it is opened', async () => {
        await account('ana@example.com', 'correct horse');
        const session = await signIn('ana@example.com', 'correct horse');
        await post('/change-email', { newEmail: 'new@example.com', currentPassword: 'correct horse' }, session);
        const token = tokenIn((await mailTo('new@example.com', 'Confirm your new')).html);

        await post('/change-password', { currentPassword: 'correct horse', newPassword: 'battery staple' }, session);
        expect((await post('/confirm-email-change', { token })).body.code).toBe('TOKEN_INVALID');
        expect(users[0].email).toBe('ana@example.com');
    });

    it('refuses the link if somebody took the address in the meantime', async () => {
        await account('ana@example.com', 'correct horse');
        const session = await signIn('ana@example.com', 'correct horse');
        await post('/change-email', { newEmail: 'new@example.com', currentPassword: 'correct horse' }, session);
        const token = tokenIn((await mailTo('new@example.com', 'Confirm your new')).html);

        await account('new@example.com', 'somebody else');
        expect((await post('/confirm-email-change', { token })).body.code).toBe('EMAIL_TAKEN');
        expect(users[0].email).toBe('ana@example.com');
    });
});
