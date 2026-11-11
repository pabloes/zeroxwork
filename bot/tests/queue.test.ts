import { describe, it, expect } from 'vitest';
import { MAX_ATTEMPTS, planJobs } from '../src/queue.js';

describe('planJobs', () => {
    it('collapses several rows for the same account into one sync', () => {
        const plan = planJobs([
            { id: 1, discordId: 'A', attempts: 0 },
            { id: 2, discordId: 'A', attempts: 0 },
            { id: 3, discordId: 'B', attempts: 0 },
        ]);

        expect(plan.discordIds).toEqual(['A', 'B']);
        expect(plan.rowsByDiscordId.get('A')).toEqual([1, 2]);
    });

    it('keeps every row of an account so they are all deleted together', () => {
        const plan = planJobs([
            { id: 7, discordId: 'A', attempts: 0 },
            { id: 9, discordId: 'A', attempts: 2 },
        ]);

        expect(plan.rowsByDiscordId.get('A')).toEqual([7, 9]);
        expect(plan.discordIds).toHaveLength(1);
    });

    it('drops a row that has failed too many times instead of looping forever', () => {
        const plan = planJobs([
            { id: 1, discordId: 'A', attempts: MAX_ATTEMPTS },
            { id: 2, discordId: 'B', attempts: 0 },
        ]);

        expect(plan.giveUp).toEqual([1]);
        expect(plan.discordIds).toEqual(['B']);
    });

    it('handles an empty queue', () => {
        const plan = planJobs([]);
        expect(plan.discordIds).toEqual([]);
        expect(plan.giveUp).toEqual([]);
    });

    it('keeps the order the rows were written in, so events apply oldest first', () => {
        const plan = planJobs([
            { id: 1, discordId: 'B', attempts: 0 },
            { id: 2, discordId: 'A', attempts: 0 },
        ]);
        expect(plan.discordIds).toEqual(['B', 'A']);
    });
});
