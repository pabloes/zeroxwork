import { describe, it, expect } from 'vitest';
import { PORTFOLIO_PROJECTS, PORTFOLIO_CATEGORY } from '../src/constants/portfolio-seed.js';
import { validateHandle } from '../src/config/profile.js';
import { slugify } from '../src/utils/slug.js';

describe('portfolio seed data', () => {
    it('is seeded under the project category', () => {
        expect(PORTFOLIO_CATEGORY).toBe('project');
        expect(PORTFOLIO_PROJECTS.length).toBeGreaterThan(0);
    });

    it('has one unique, URL-safe slug per project', () => {
        const slugs = PORTFOLIO_PROJECTS.map((p) => p.slug);
        expect(new Set(slugs).size).toBe(slugs.length);
        slugs.forEach((slug) => expect(slugify(slug)).toBe(slug));
    });

    it('fills in everything a card needs', () => {
        PORTFOLIO_PROJECTS.forEach((project) => {
            expect(project.title.trim()).not.toBe('');
            expect(project.content.trim().length).toBeGreaterThan(80);
            expect(project.tags.length).toBeGreaterThan(0);
            expect(project.credits.length).toBeGreaterThan(0);
        });
    });

    it('keeps tags uppercase, the way the tags table stores them', () => {
        PORTFOLIO_PROJECTS.forEach((project) => {
            project.tags.forEach((tag) => expect(tag).toBe(tag.toUpperCase()));
            expect(new Set(project.tags).size).toBe(project.tags.length);
        });
    });

    it('serves every cover image from our own site', () => {
        PORTFOLIO_PROJECTS.forEach((project) => {
            if (project.thumbnail === null) return;
            expect(project.thumbnail.startsWith('/')).toBe(true);
        });
    });

    it('only credits handles a member could actually claim', () => {
        PORTFOLIO_PROJECTS.forEach((project) => {
            project.credits.forEach((credit) => {
                expect(credit.name.trim()).not.toBe('');
                if (credit.handle === undefined) return;
                expect(validateHandle(credit.handle)).toEqual({ ok: true, value: credit.handle });
            });
        });
    });

    it('never credits the same name twice in one project', () => {
        PORTFOLIO_PROJECTS.forEach((project) => {
            const names = project.credits.map((c) => c.name);
            expect(new Set(names).size).toBe(names.length);
        });
    });
});
