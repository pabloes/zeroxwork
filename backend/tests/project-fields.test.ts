import { describe, it, expect } from 'vitest';
import {
    validateTitle,
    validateContent,
    validateSummary,
    validateStatus,
    validateSiteUrl,
    validateRepoUrl,
    validateDate,
    validateDates,
    slugWithLetter,
    SUMMARY_MAX,
    TITLE_MAX,
    PROJECT_STATUSES,
} from '../src/config/project-fields.js';

describe('title and body', () => {
    it('asks for a title and trims it', () => {
        expect(validateTitle('  Golfcraft  ')).toEqual({ ok: true, value: 'Golfcraft' });
        expect(validateTitle('')).toEqual({ ok: false, code: 'TITLE_REQUIRED' });
        expect(validateTitle('   ')).toEqual({ ok: false, code: 'TITLE_REQUIRED' });
        expect(validateTitle(null)).toEqual({ ok: false, code: 'TITLE_REQUIRED' });
    });

    it('refuses a title longer than the column is worth', () => {
        expect(validateTitle('a'.repeat(TITLE_MAX))).toEqual({ ok: true, value: 'a'.repeat(TITLE_MAX) });
        expect(validateTitle('a'.repeat(TITLE_MAX + 1))).toEqual({ ok: false, code: 'TITLE_LONG' });
    });

    it('asks for a write-up: a gallery with no words is not a project page', () => {
        expect(validateContent('Lo hicimos en tres meses.')).toEqual({ ok: true, value: 'Lo hicimos en tres meses.' });
        expect(validateContent('')).toEqual({ ok: false, code: 'CONTENT_REQUIRED' });
    });
});

describe('summary', () => {
    it('is optional, and empty clears it', () => {
        expect(validateSummary('')).toEqual({ ok: true, value: null });
        expect(validateSummary(undefined)).toEqual({ ok: true, value: null });
        expect(validateSummary('  ')).toEqual({ ok: true, value: null });
    });

    it('is a line, not a second body', () => {
        expect(validateSummary('x'.repeat(SUMMARY_MAX))).toEqual({ ok: true, value: 'x'.repeat(SUMMARY_MAX) });
        expect(validateSummary('x'.repeat(SUMMARY_MAX + 1))).toEqual({ ok: false, code: 'SUMMARY_LONG' });
    });
});

describe('status', () => {
    it('takes the known states in any case', () => {
        for (const status of PROJECT_STATUSES) {
            expect(validateStatus(status.toUpperCase())).toEqual({ ok: true, value: status });
        }
    });

    it('is optional but not free text', () => {
        expect(validateStatus('')).toEqual({ ok: true, value: null });
        expect(validateStatus('casi terminado')).toEqual({ ok: false, code: 'STATUS_INVALID' });
    });
});

describe('the site link', () => {
    it('takes any https host', () => {
        expect(validateSiteUrl('https://golfcraft.io/play')).toEqual({ ok: true, value: 'https://golfcraft.io/play' });
    });

    it('is optional, and refuses what would not open', () => {
        expect(validateSiteUrl('')).toEqual({ ok: true, value: null });
        expect(validateSiteUrl('http://golfcraft.io')).toEqual({ ok: false, code: 'SITE_URL_INVALID' });
        expect(validateSiteUrl('javascript:alert(1)')).toEqual({ ok: false, code: 'SITE_URL_INVALID' });
        expect(validateSiteUrl('golfcraft.io')).toEqual({ ok: false, code: 'SITE_URL_INVALID' });
    });
});

describe('the repository link', () => {
    it('takes GitHub and GitLab, and their subdomains', () => {
        expect(validateRepoUrl('https://github.com/pabloes/ohmyserver'))
            .toEqual({ ok: true, value: 'https://github.com/pabloes/ohmyserver' });
        expect(validateRepoUrl('https://gitlab.com/grupo/repo'))
            .toEqual({ ok: true, value: 'https://gitlab.com/grupo/repo' });
        expect(validateRepoUrl('https://www.github.com/pabloes/ohmyserver').ok).toBe(true);
    });

    it('is optional', () => {
        expect(validateRepoUrl('')).toEqual({ ok: true, value: null });
        expect(validateRepoUrl(null)).toEqual({ ok: true, value: null });
    });

    it('refuses a host that only looks like one of them', () => {
        expect(validateRepoUrl('https://github.com.evil.net/x')).toEqual({ ok: false, code: 'REPO_HOST_NOT_ALLOWED' });
        expect(validateRepoUrl('https://bitbucket.org/x/y')).toEqual({ ok: false, code: 'REPO_HOST_NOT_ALLOWED' });
        expect(validateRepoUrl('http://github.com/x/y')).toEqual({ ok: false, code: 'REPO_URL_INVALID' });
    });

    it('refuses a bare host: a repository button has to open a repository', () => {
        expect(validateRepoUrl('https://github.com')).toEqual({ ok: false, code: 'REPO_URL_INVALID' });
        expect(validateRepoUrl('https://github.com/')).toEqual({ ok: false, code: 'REPO_URL_INVALID' });
    });
});

describe('dates', () => {
    it('reads what a date field sends', () => {
        const parsed = validateDate('2023-04-01');
        expect(parsed.ok).toBe(true);
        expect(parsed.ok && parsed.value?.getUTCFullYear()).toBe(2023);
    });

    it('is optional', () => {
        expect(validateDate('')).toEqual({ ok: true, value: null });
        expect(validateDate(undefined)).toEqual({ ok: true, value: null });
    });

    it('refuses what is not a date, and a year nobody meant to type', () => {
        expect(validateDate('ayer')).toEqual({ ok: false, code: 'DATE_INVALID' });
        expect(validateDate('1492-01-01')).toEqual({ ok: false, code: 'DATE_INVALID' });
        expect(validateDate('2999-01-01')).toEqual({ ok: false, code: 'DATE_INVALID' });
    });

    it('takes either end on its own', () => {
        expect(validateDates('2022-01-01', '').ok).toBe(true);
        expect(validateDates('', '2022-01-01').ok).toBe(true);
        expect(validateDates('', '')).toEqual({ ok: true, value: { startedAt: null, endedAt: null } });
    });

    it('refuses a project that ended before it started', () => {
        expect(validateDates('2023-01-01', '2022-01-01')).toEqual({ ok: false, code: 'DATES_BACKWARDS' });
        expect(validateDates('2023-01-01', '2023-01-01').ok).toBe(true);
    });
});

describe('a slug that would be read as an id', () => {
    it('gives a word to a number, because /portfolio/2048 is an id', () => {
        expect(slugWithLetter('2048')).toBe('project-2048');
        expect(slugWithLetter('2024-2025')).toBe('project-2024-2025');
    });

    it('leaves a slug with a letter in it alone', () => {
        expect(slugWithLetter('golfcraft')).toBe('golfcraft');
        expect(slugWithLetter('claim-bite-2')).toBe('claim-bite-2');
    });
});
