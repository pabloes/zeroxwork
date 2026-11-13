/**
 * Linking a wallet over real HTTP, with real signatures and the database stood in for.
 *
 * The hole this closes: the server used to verify the signature against
 * whatever text the client sent along, so any signature a wallet had ever made
 * was enough to link it to somebody else's account.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

const users: any[] = [];
const wallets: any[] = [];

vi.mock('../src/db/index.js', () => ({
    prisma: {
        user: {
            findUnique: async ({ where }: any) => {
                const row = users.find((u) => u.id === where.id);
                return row ? { ...row, wallets: wallets.filter((w) => w.userId === row.id).map((w) => ({ ...w, walletNames: [] })) } : null;
            },
            update: async () => ({}),
        },
        wallet: {
            findFirst: async ({ where }: any) => wallets.find((w) => Object.entries(where).every(([k, v]) => w[k] === v)) ?? null,
            create: async ({ data }: any) => {
                // the address is unique in the real table
                if (wallets.some((w) => w.address === data.address)) throw Object.assign(new Error('unique'), { code: 'P2002' });
                const row = { id: wallets.length + 1, ...data };
                wallets.push(row);
                return row;
            },
        },
    },
}));

vi.mock('../src/config/env.js', () => ({
    env: { JWT_SECRET: 'jwt-secret-for-tests', VERIFICATION_RESEND_SECRET: 'x', SESSION_SECRET: 'x', ADMIN_COOKIE_PASSWORD: 'x' },
    requireEnv: (name: string) => name,
}));
// the names a wallet owns come from the chain: not what is under test
vi.mock('../src/services/decentraland-names.js', () => ({ updateUserExtraSpace: async () => undefined, updateWalletNames: async () => [] }));
vi.mock('express-rate-limit', () => ({ default: () => (_req: any, _res: any, next: any) => next() }));

let base = '';
let server: any;
let sessionFor: (userId: number) => string;

beforeAll(async () => {
    const express = (await import('express')).default;
    const walletRoutes = (await import('../src/routes/wallet.js')).default;
    const { signSession } = await import('../src/services/auth-tokens.js');
    sessionFor = (userId) => signSession(users.find((u) => u.id === userId), 'jwt-secret-for-tests');
    const app = express();
    app.use(express.json());
    app.use('/api/wallet', walletRoutes);
    await new Promise<void>((done) => { server = app.listen(0, done); });
    base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(() => server?.close());

beforeEach(() => {
    users.length = 0;
    wallets.length = 0;
    users.push(
        { id: 1, email: 'owner@example.com', role: 'USER', password: 'hash-one' },
        { id: 2, email: 'thief@example.com', role: 'USER', password: 'hash-two' },
    );
});

async function call(method: string, path: string, userId: number | null, body?: unknown) {
    const res = await fetch(`${base}/api/wallet${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', ...(userId ? { Authorization: `Bearer ${sessionFor(userId)}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() as any };
}

const wantedBy = (userId: number, address: string) => call('GET', `/bind-message?address=${address}`, userId);

describe('linking a wallet', () => {
    it('works when the wallet signs the text the server wrote for that account', async () => {
        const wallet = privateKeyToAccount(generatePrivateKey());
        const wanted = await wantedBy(1, wallet.address);
        expect(wanted.status).toBe(200);
        expect(wanted.body.message).toContain('Account: 1');

        const signature = await wallet.signMessage({ message: wanted.body.message });
        const bound = await call('POST', '/bind', 1, { address: wallet.address, signature, expires: wanted.body.expires, code: wanted.body.code });
        expect(bound.status).toBe(200);
        expect(wallets).toEqual([expect.objectContaining({ userId: 1, address: wallet.address.toLowerCase() })]);
        // the row that comes back must not carry the password hash
        expect(JSON.stringify(bound.body)).not.toContain('hash-one');
    });

    it('refuses a signature of anything else, which is all it used to take', async () => {
        const victim = privateKeyToAccount(generatePrivateKey());
        // what every visitor signed before, and what a phishing page could ask for again
        const old = await victim.signMessage({ message: 'Binding wallet' });

        const asBefore = await call('POST', '/bind', 2, { address: victim.address, signature: old, message: 'Binding wallet' });
        expect(asBefore.status).toBe(400);

        // with a proof of their own for that address: the text to sign names their account, and the victim never signed that
        const wanted = await wantedBy(2, victim.address);
        const withProof = await call('POST', '/bind', 2, { address: victim.address, signature: old, expires: wanted.body.expires, code: wanted.body.code });
        expect(withProof.status).toBe(400);
        expect(withProof.body.code).toBe('WALLET_SIGNATURE_INVALID');
        expect(wallets).toHaveLength(0);
    });

    it('does not let one account reuse what a wallet signed for another', async () => {
        const wallet = privateKeyToAccount(generatePrivateKey());
        const wanted = await wantedBy(1, wallet.address);
        const signature = await wallet.signMessage({ message: wanted.body.message });

        // the thief saw the whole exchange: address, signature, expiry and code
        const replay = await call('POST', '/bind', 2, { address: wallet.address, signature, expires: wanted.body.expires, code: wanted.body.code });
        expect(replay.status).toBe(400);
        expect(replay.body.code).toBe('WALLET_PROOF_INVALID');

        const own = await wantedBy(2, wallet.address);
        const withOwnProof = await call('POST', '/bind', 2, { address: wallet.address, signature, expires: own.body.expires, code: own.body.code });
        expect(withOwnProof.body.code).toBe('WALLET_SIGNATURE_INVALID');
        expect(wallets).toHaveLength(0);
    });

    it('refuses a signature made by a different wallet', async () => {
        const claimed = privateKeyToAccount(generatePrivateKey());
        const actual = privateKeyToAccount(generatePrivateKey());
        const wanted = await wantedBy(1, claimed.address);
        const signature = await actual.signMessage({ message: wanted.body.message });
        const res = await call('POST', '/bind', 1, { address: claimed.address, signature, expires: wanted.body.expires, code: wanted.body.code });
        expect(res.body.code).toBe('WALLET_SIGNATURE_INVALID');
    });

    it('says so when the wallet already belongs to another account', async () => {
        const wallet = privateKeyToAccount(generatePrivateKey());
        for (const userId of [1, 2]) {
            const wanted = await wantedBy(userId, wallet.address);
            const signature = await wallet.signMessage({ message: wanted.body.message });
            const res = await call('POST', '/bind', userId, { address: wallet.address, signature, expires: wanted.body.expires, code: wanted.body.code });
            if (userId === 1) expect(res.status).toBe(200);
            else expect(res.body).toMatchObject({ code: 'WALLET_TAKEN' });
        }
        expect(wallets).toHaveLength(1);
    });

    it('answers 400, not a crash, to what is not an address or a signature', async () => {
        const wallet = privateKeyToAccount(generatePrivateKey());
        const wanted = await wantedBy(1, wallet.address);
        expect((await wantedBy(1, 'vitalik.eth')).body.code).toBe('WALLET_ADDRESS_INVALID');
        expect((await call('POST', '/bind', 1, {})).status).toBe(400);
        expect((await call('POST', '/bind', 1, { address: wallet.address, signature: 'not-hex', expires: wanted.body.expires, code: wanted.body.code })).body.code).toBe('WALLET_SIGNATURE_INVALID');
        expect((await call('POST', '/bind', 1, { address: wallet.address, signature: '0xabcdef', expires: wanted.body.expires, code: wanted.body.code })).body.code).toBe('WALLET_SIGNATURE_INVALID');
    });

    it('is only for somebody signed in', async () => {
        expect((await call('GET', '/bind-message?address=0x52908400098527886e0f7030069857d2e4169ee7', null)).status).toBe(401);
        expect((await call('POST', '/bind', null, {})).status).toBe(401);
    });
});
