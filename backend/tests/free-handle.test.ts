import { describe, it, expect, vi, beforeEach } from 'vitest';

const findFirst = vi.fn();
vi.mock('../src/db/index.js', () => ({
    prisma: { user: { findFirst: (...args: any[]) => findFirst(...args) } },
}));

const { freeHandle } = await import('../src/services/public-handle.js');
const { HANDLE_MAX } = await import('../src/config/profile.js');

/** Pretend these handles are already in the users table. */
function taken(...handles: string[]) {
    findFirst.mockImplementation(async ({ where }: any) =>
        handles.includes(where.handle) ? { id: 1 } : null);
}

describe('freeHandle', () => {
    beforeEach(() => {
        findFirst.mockReset();
    });

    it('gives back the handle untouched when nobody has it', async () => {
        taken();
        expect(await freeHandle('carlosmu')).toBe('carlosmu');
    });

    it('suffixes with the first free number when somebody has it', async () => {
        taken('pablo');
        expect(await freeHandle('pablo')).toBe('pablo-2');
    });

    it('keeps counting past the suffixed ones', async () => {
        taken('pablo', 'pablo-2', 'pablo-3');
        expect(await freeHandle('pablo')).toBe('pablo-4');
    });

    // The handle is part of a URL and the column has a length rule, so a long
    // name must not produce a suffix that gets cut off and collides again.
    it('leaves room for the suffix on a name that is already at the limit', async () => {
        const long = 'a'.repeat(HANDLE_MAX);
        taken(long);
        const result = await freeHandle(long);
        expect(result.length).toBeLessThanOrEqual(HANDLE_MAX);
        expect(result).toMatch(/-2$/);
    });

    it('does not count the account being edited as a collision', async () => {
        findFirst.mockImplementation(async ({ where }: any) => {
            // The route asks "anybody but me", so the mock answers accordingly.
            if (where.handle !== 'pablo') return null;
            return where.id?.not === 7 ? null : { id: 7 };
        });
        expect(await freeHandle('pablo', 7)).toBe('pablo');
    });

    // Nothing in the loop can collide forever: after 99 the suffix stops being
    // a counter, so two people registering at once cannot spin here.
    it('falls back to a non-sequential suffix once the numbers run out', async () => {
        findFirst.mockResolvedValue({ id: 1 });
        const result = await freeHandle('pablo');
        expect(result.startsWith('pablo-')).toBe(true);
        expect(result).not.toBe('pablo-99');
    });

    // A registration must not die because the database hiccuped on a name
    // check; the caller decides what to do with the null.
    it('answers null when the handles cannot be read', async () => {
        findFirst.mockRejectedValue(new Error('connection lost'));
        expect(await freeHandle('pablo')).toBeNull();
    });
});
