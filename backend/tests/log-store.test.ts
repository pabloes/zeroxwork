import { describe, it, expect, beforeEach, vi } from 'vitest';

async function loadStore() {
    return await import('../src/services/log-store.js');
}

describe('redact', () => {
    beforeEach(() => vi.resetModules());

    it('removes JWTs, so verification links in logs are not reusable', async () => {
        const { redact } = await loadStore();
        const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOjd9.s1gn4tur3-v4lu3';

        const out = redact(`https://zeroxwork.com/verify?token=${jwt}`);

        expect(out).not.toContain(jwt);
        expect(out).not.toContain('s1gn4tur3-v4lu3');
    });

    it('removes bearer tokens and password-like pairs', async () => {
        const { redact } = await loadStore();

        expect(redact('Authorization: Bearer abc123.def456')).not.toContain('abc123');
        expect(redact('SMTP_PASS=hunter2 connecting')).not.toContain('hunter2');
        expect(redact('{"password":"hunter2"}')).not.toContain('hunter2');
    });

    it('leaves ordinary text alone', async () => {
        const { redact } = await loadStore();

        expect(redact('GET /api/blog/articles 200 12ms')).toBe('GET /api/blog/articles 200 12ms');
    });
});

describe('log buffer', () => {
    beforeEach(() => vi.resetModules());

    it('stores entries and filters them by level, scope and substring', async () => {
        const { record, query, clear } = await loadStore();
        clear();

        record('info', 'http', 'GET /api/blog 200');
        record('error', 'mail', 'Fallo al enviar correo a a@b.c');

        expect(query({ level: 'error' }).entries).toHaveLength(1);
        expect(query({ scope: 'mail' }).entries[0].message).toContain('Fallo al enviar');
        expect(query({ q: '/api/blog' }).entries).toHaveLength(1);
        expect(query({ q: 'nothing matches this' }).entries).toHaveLength(0);
    });

    it('redacts what it stores, not just what it prints', async () => {
        const { record, query, clear } = await loadStore();
        clear();

        record('info', 'mail', 'link token=eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOjd9.s1gn4tur3', {
            password: 'hunter2',
        });

        const entry = query({ scope: 'mail' }).entries[0];
        expect(JSON.stringify(entry)).not.toContain('s1gn4tur3');
        expect(JSON.stringify(entry)).not.toContain('hunter2');
    });

    it('clear() empties the buffer', async () => {
        const { record, query, clear } = await loadStore();
        clear();

        record('info', 'http', 'one');
        expect(clear()).toBe(1);
        expect(query().entries).toHaveLength(0);
    });
});
