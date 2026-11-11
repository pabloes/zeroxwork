/**
 * The public API over real HTTP, with the database stood in for.
 *
 * The shaping is tested next door without a server; this is here for the
 * things only a request can show: that a browser on somebody else's site is
 * allowed to call it, that a draft is a 404 and not a 403, that a wrong path
 * answers in JSON instead of an Express error page, and that the query string
 * reaches the query.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

/** One published project, as the database hands it over. */
const projectRow = {
    id: 7, slug: 'money-grass', title: 'Money Grass', summary: 'Un cómic',
    content: '# Money Grass\n\nTexto largo.', lang: 'es',
    thumbnail: '/api/images/user-uploaded-images/abc.jpg',
    screenshots: ['/api/images/user-uploaded-images/uno.jpg'],
    videoUrl: 'https://youtube.com/watch?v=xyz', siteUrl: null, repoUrl: null,
    startedAt: new Date('2025-03-01'), endedAt: null, status: 'live', featured: true,
    createdAt: new Date('2025-04-01'), updatedAt: new Date('2025-04-02'),
    tags: [{ id: 1, name: 'comic' }],
    members: [{ name: 'Pablo', role: 'código', position: 0, userId: 1,
        user: { id: 1, handle: 'pablo', displayName: 'Pablo Estornut', avatarUrl: null } }],
    translations: [],
};

const calls: any[] = [];

vi.mock('../src/db/index.js', () => ({
    prisma: {
        project: {
            count: async (args: any) => { calls.push(['count', args]); return 1; },
            findMany: async (args: any) => { calls.push(['findMany', args]); return [projectRow]; },
            findUnique: async (args: any) => {
                calls.push(['findUnique', args]);
                const asked = args.where.slug ?? args.where.id;
                if (asked === 'no-existe' || asked === 999) return null;
                if (asked === 'borrador') return { ...projectRow, published: false };
                return { ...projectRow, published: true };
            },
        },
    },
}));

let base = '';
let server: any;

beforeAll(async () => {
    const express = (await import('express')).default;
    const cors = (await import('cors')).default;
    const publicApi = (await import('../src/routes/public-api.js')).default;
    const app = express();
    app.use('/api/public', cors({ origin: '*', methods: ['GET'], credentials: false }), publicApi);
    await new Promise<void>((done) => { server = app.listen(0, done); });
    base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(() => server?.close());

describe('over HTTP', () => {
    it('describes itself, so it can be read without docs', async () => {
        const res = await fetch(`${base}/api/public/v1`);
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body.version).toBe(1);
        expect(body.endpoints).toHaveLength(2);
    });

    it('answers a browser on anybody else\'s site', async () => {
        const res = await fetch(`${base}/api/public/v1/projects`, { headers: { Origin: 'https://otra-web.com' } });
        expect(res.headers.get('access-control-allow-origin')).toBe('*');
        expect(res.headers.get('access-control-allow-credentials')).toBeNull();
    });

    it('pages the list and leaves the body text out of it', async () => {
        calls.length = 0;
        const res = await fetch(`${base}/api/public/v1/projects?limit=3&offset=6`);
        const body = await res.json();
        expect(body).toMatchObject({ total: 1, limit: 3, offset: 6 });
        expect(body.items[0].content).toBeUndefined();
        expect(body.items[0].cover).toMatch(/^https:\/\//);
        const findMany = calls.find((c) => c[0] === 'findMany')![1];
        expect(findMany.take).toBe(3);
        expect(findMany.skip).toBe(6);
        expect(findMany.where.published).toBe(true);
    });

    it('passes the tag and the author through to the query', async () => {
        calls.length = 0;
        await fetch(`${base}/api/public/v1/projects?tag=Comic&author=PABLO`);
        const where = calls.find((c) => c[0] === 'findMany')![1].where;
        expect(where.tags.some.name).toEqual({ equals: 'Comic', mode: 'insensitive' });
        expect(where.members.some.user.handle).toBe('pablo');
    });

    it('gives one project with its body text', async () => {
        const res = await fetch(`${base}/api/public/v1/projects/money-grass`);
        const body = await res.json();
        expect(body.content).toContain('Texto largo');
        expect(body.authors[0].url).toContain('/member/pablo');
        expect(body).not.toHaveProperty('published');
    });

    it('takes the id as readily as the slug', async () => {
        calls.length = 0;
        const res = await fetch(`${base}/api/public/v1/projects/7`);
        expect(res.status).toBe(200);
        expect(calls.find((c) => c[0] === 'findUnique')![1].where).toEqual({ id: 7 });
    });

    it('says a draft is not there, rather than that it is forbidden', async () => {
        const res = await fetch(`${base}/api/public/v1/projects/borrador`);
        expect(res.status).toBe(404);
        expect((await res.json()).error).toBe('No such project.');
    });

    it('answers an unknown path in JSON, not in HTML', async () => {
        const res = await fetch(`${base}/api/public/v2/lo-que-sea`);
        expect(res.status).toBe(404);
        expect(res.headers.get('content-type')).toContain('application/json');
        expect((await res.json()).error).toContain('/api/public/v1');
    });
});
