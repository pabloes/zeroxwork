import { describe, it, expect } from 'vitest';
import { quotaFloorBytes, effectiveMaxQuota, DEFAULT_MAX_QUOTA_MB } from '../src/services/quota.js';

const MB = 1024 * 1024;
const OLD_COLUMN_DEFAULT = 5 * MB;

describe('quota floor', () => {
    it('falls back to the built-in default when the env var is unset', () => {
        expect(quotaFloorBytes(undefined)).toBe(DEFAULT_MAX_QUOTA_MB * MB);
    });

    it('reads megabytes from the env var', () => {
        expect(quotaFloorBytes('1024')).toBe(1024 * MB);
    });

    it('ignores junk, zero and negative values', () => {
        ['', 'mucho', '0', '-50'].forEach((raw) => {
            expect(quotaFloorBytes(raw)).toBe(DEFAULT_MAX_QUOTA_MB * MB);
        });
    });
});

describe('effective max quota', () => {
    it('lifts accounts still sitting on the old 5 MB column default', () => {
        expect(effectiveMaxQuota(OLD_COLUMN_DEFAULT, '500')).toBe(500 * MB);
    });

    it('keeps a bigger per-user value set by an admin', () => {
        expect(effectiveMaxQuota(2048 * MB, '500')).toBe(2048 * MB);
    });

    it('survives a missing column value', () => {
        expect(effectiveMaxQuota(null, '500')).toBe(500 * MB);
    });
});
