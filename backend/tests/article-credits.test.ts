import { describe, it, expect, vi, beforeEach } from 'vitest';

const findMany = vi.fn();
vi.mock('../src/db/index.js', () => ({
    prisma: { user: { findMany: (...args: any[]) => findMany(...args) } },
}));

const { normaliseCredits, CreditError, MAX_CREDITS } = await import('../src/services/article-credits.js');

describe('article credits', () => {
    beforeEach(() => {
        findMany.mockReset();
        findMany.mockResolvedValue([]);
    });

    it('treats a missing list as no credits and asks the database nothing', async () => {
        expect(await normaliseCredits(undefined)).toEqual([]);
        expect(await normaliseCredits(null)).toEqual([]);
        expect(await normaliseCredits([])).toEqual([]);
        expect(findMany).not.toHaveBeenCalled();
    });

    it('keeps the typed name even when nobody owns it', async () => {
        expect(await normaliseCredits([{ name: '  Llacer  ', role: ' 3D ' }]))
            .toEqual([{ name: 'Llacer', role: '3D', userId: null }]);
    });

    it('links a credit to the account behind the handle', async () => {
        findMany.mockResolvedValue([{ id: 7, handle: 'carlosmu' }]);
        expect(await normaliseCredits([{ name: 'Carlos', handle: 'CarlosMu' }]))
            .toEqual([{ name: 'Carlos', role: null, userId: 7 }]);
    });

    it('drops a userId that no longer exists rather than failing the save', async () => {
        findMany.mockResolvedValue([]);
        expect(await normaliseCredits([{ name: 'Ghost', userId: 999 }]))
            .toEqual([{ name: 'Ghost', role: null, userId: null }]);
    });

    it('prefers the handle over a userId that disagrees with it', async () => {
        findMany.mockResolvedValue([{ id: 7, handle: 'carlosmu' }, { id: 3, handle: null }]);
        expect(await normaliseCredits([{ name: 'Carlos', handle: 'carlosmu', userId: 3 }]))
            .toEqual([{ name: 'Carlos', role: null, userId: 7 }]);
    });

    it('drops blank names and deduplicates, which the unique index would reject', async () => {
        expect(await normaliseCredits([
            { name: 'Pablo' }, { name: '   ' }, { name: 'pablo', role: 'art' }, { name: 'Carlos' },
        ])).toEqual([
            { name: 'Pablo', role: null, userId: null },
            { name: 'Carlos', role: null, userId: null },
        ]);
    });

    it('turns an empty role into null', async () => {
        expect(await normaliseCredits([{ name: 'Pablo', role: '  ' }]))
            .toEqual([{ name: 'Pablo', role: null, userId: null }]);
    });

    it('refuses anything that is not a list', async () => {
        await expect(normaliseCredits('Carlos')).rejects.toBeInstanceOf(CreditError);
        await expect(normaliseCredits({ name: 'Carlos' })).rejects.toBeInstanceOf(CreditError);
    });

    it('refuses a list longer than the ceiling', async () => {
        const many = Array.from({ length: MAX_CREDITS + 1 }, (_, i) => ({ name: `P${i}` }));
        await expect(normaliseCredits(many)).rejects.toBeInstanceOf(CreditError);
    });

    it('refuses an overlong name or role', async () => {
        await expect(normaliseCredits([{ name: 'x'.repeat(61) }])).rejects.toBeInstanceOf(CreditError);
        await expect(normaliseCredits([{ name: 'Pablo', role: 'y'.repeat(41) }])).rejects.toBeInstanceOf(CreditError);
    });
});
