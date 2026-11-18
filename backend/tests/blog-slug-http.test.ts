import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';

const original = {
    id: 14,
    slug: 'zeroxcity-concurso-de-comics-2',
    lang: 'es',
    published: true,
    sourceHash: 'current',
};
const translation = {
    articleId: original.id,
    targetLang: 'en',
    slug: 'zeroxcity-comic-contest',
    sourceHash: original.sourceHash,
};
const history = [
    { articleId: original.id, lang: 'en', slug: translation.slug },
    { articleId: original.id, lang: 'es', slug: 'concurso-anterior' },
];

vi.mock('../src/db/index.js', () => ({
    prisma: {
        article: {
            findUnique: async ({ where }: { where: { slug?: string; id?: number } }) => {
                if (where.slug === 'draft') return { ...original, slug: 'draft', published: false };
                return where.slug === original.slug || where.id === original.id ? original : null;
            },
        },
        articleSlug: {
            findUnique: async ({ where }: { where: { slug: string } }) =>
                history.find((entry) => entry.slug === where.slug) ?? null,
            findMany: async () => history,
        },
        articleTranslation: {
            findUnique: async () => translation,
        },
    },
}));

let server: Server;
let base: string;

beforeAll(async () => {
    const blog = (await import('../src/routes/blog.js')).default;
    const app = express();
    app.use('/api/blog', blog);
    await new Promise<void>((resolve, reject) => {
        server = app.listen(0, '127.0.0.1', resolve).once('error', reject);
    });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/blog/articles/by-slug`;
});

afterAll(() => server?.close());

it('opens the original slug without a history entry and includes it in the translation links', async () => {
    const source = await fetch(`${base}/${original.slug}`);
    expect(source.status).toBe(200);
    expect(await source.json()).toMatchObject({ id: original.id, lang: 'es', slug: original.slug });

    const english = await fetch(`${base}/${translation.slug}`);
    expect(english.status).toBe(200);
    expect(await english.json()).toMatchObject({
        isTranslation: true,
        hreflang: [{ lang: 'es', slug: original.slug }, { lang: 'en', slug: translation.slug }],
    });
});

it('points historical original slugs at the canonical original', async () => {
    const response = await fetch(`${base}/concurso-anterior`, { redirect: 'manual' });
    expect(response.status).toBe(301);
    expect(await response.json()).toEqual({ redirect: true, slug: original.slug });
});

it('keeps unpublished originals private when falling back to the article slug', async () => {
    const response = await fetch(`${base}/draft`);
    expect(response.status).toBe(404);
});
