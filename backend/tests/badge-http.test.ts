/**
 * The badge over real HTTP. The drawing is tested next door; this is here for
 * what only a request shows: that somebody else's page is allowed to load it,
 * that it arrives as an image a browser will cache, that both the handle and
 * the account number lead to it, and that anything else is a 404 rather than
 * an Express error page with our stack in it.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

const member = {
    id: 7,
    handle: 'carlosmu',
    avatarUrl: null,
    defaultName: null,
};

const asked: any[] = [];

vi.mock('../src/db/index.js', () => ({
    prisma: {
        user: {
            findUnique: async (args: any) => {
                asked.push(args.where);
                if (args.where.id === 7 || args.where.handle === 'carlosmu') return member;
                return null;
            },
        },
    },
}));

let base = '';
let server: any;

beforeAll(async () => {
    const express = (await import('express')).default;
    const cors = (await import('cors')).default;
    const badge = (await import('../src/routes/badge.js')).default;
    const app = express();
    app.use('/api/badge', cors({ origin: '*', methods: ['GET'], credentials: false }), badge);
    await new Promise<void>((done) => { server = app.listen(0, done); });
    base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(() => server?.close());

describe('GET /api/badge/<handle>.svg', () => {
    it('answers with an image any page may load', async () => {
        const response = await fetch(`${base}/api/badge/carlosmu.svg`);
        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toContain('image/svg+xml');
        expect(response.headers.get('access-control-allow-origin')).toBe('*');
        expect(response.headers.get('cache-control')).toContain('max-age');

        const svg = await response.text();
        expect(svg).toContain('<svg');
        expect(svg).toContain('carlosmu');
        expect(svg).toContain('ZEROxWORK.com');
    });

    it('also answers to the account number', async () => {
        const response = await fetch(`${base}/api/badge/7.svg`);
        expect(response.status).toBe(200);
        expect(asked).toContainEqual({ id: 7 });
    });

    it('is a 404 for a member who is not there', async () => {
        const response = await fetch(`${base}/api/badge/nobody.svg`);
        expect(response.status).toBe(404);
        expect(response.headers.get('content-type')).toContain('text/plain');
    });

    it('never reaches the database with a handle that cannot be one', async () => {
        const before = asked.length;
        const response = await fetch(`${base}/api/badge/${encodeURIComponent('../secret')}.svg`);
        expect(response.status).toBe(404);
        expect(asked.length).toBe(before);
    });

    it('says where the badge is when the extension is missing', async () => {
        const response = await fetch(`${base}/api/badge/carlosmu`);
        expect(response.status).toBe(404);
        expect(await response.text()).toContain('.svg');
    });
});
