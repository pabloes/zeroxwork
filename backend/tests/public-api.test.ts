import { describe, it, expect } from 'vitest';
import { SITE_URL, absoluteUrl } from '../src/config/site.js';
import {
    ProjectRow,
    memberUrl,
    projectUrl,
    publicProject,
} from '../src/services/public-projects.js';
import { PAGE_DEFAULT, PAGE_MAX, readPaging } from '../src/routes/public-api.js';

/** A project as the database hands it over, with everything filled in. */
function row(overrides: Partial<ProjectRow> = {}): ProjectRow {
    return {
        id: 7,
        slug: 'money-grass',
        title: 'Money Grass',
        summary: 'Un cómic',
        content: '# Money Grass\n\nTexto largo.',
        lang: 'es',
        thumbnail: '/api/images/user-uploaded-images/abc.jpg',
        screenshots: [
            '/api/images/user-uploaded-images/uno.jpg',
            'https://otrositio.com/dos.png',
        ],
        videoUrl: 'https://youtube.com/watch?v=xyz',
        siteUrl: 'https://moneygrass.example',
        repoUrl: null,
        startedAt: new Date('2025-03-01T00:00:00.000Z'),
        endedAt: null,
        status: 'live',
        featured: true,
        createdAt: new Date('2025-04-01T10:00:00.000Z'),
        updatedAt: new Date('2025-04-02T10:00:00.000Z'),
        tags: [{ id: 1, name: 'comic' }, { id: 2, name: '3d' }],
        members: [
            {
                name: 'Pablo',
                role: 'código',
                position: 0,
                userId: 1,
                user: {
                    id: 1,
                    handle: 'pablo',
                    displayName: 'Pablo Estornut',
                    avatarUrl: '/api/images/user-uploaded-images/cara.jpg',
                },
            },
            // Somebody who never signed up: a name and a role, nothing more.
            { name: 'Llacer', role: '3D', position: 1, userId: null, user: null },
        ],
        translations: [
            { targetLang: 'en', title: 'Money Grass', summary: 'A comic', content: '# Money Grass\n\nLong text.' },
        ],
        ...overrides,
    };
}

describe('absoluteUrl', () => {
    it('writes out a path on our own origin', () => {
        expect(absoluteUrl('/api/images/x.jpg')).toBe(`${SITE_URL}/api/images/x.jpg`);
    });

    it('leaves somebody else\'s address exactly as it is', () => {
        expect(absoluteUrl('https://otro.com/x.png')).toBe('https://otro.com/x.png');
    });

    it('refuses what it cannot vouch for, and says nothing for nothing', () => {
        expect(absoluteUrl('//otro.com/x.png')).toBeNull(); // scheme-less: whose host?
        expect(absoluteUrl('')).toBeNull();
        expect(absoluteUrl('   ')).toBeNull();
        expect(absoluteUrl(null)).toBeNull();
        expect(absoluteUrl(undefined)).toBeNull();
    });
});

describe('publicProject', () => {
    it('hands over addresses a stranger can use, not paths', () => {
        const project = publicProject(row(), null);

        expect(project.url).toBe(`${SITE_URL}/portfolio/money-grass`);
        expect(project.cover).toBe(`${SITE_URL}/api/images/user-uploaded-images/abc.jpg`);
        expect(project.screenshots).toEqual([
            `${SITE_URL}/api/images/user-uploaded-images/uno.jpg`,
            'https://otrositio.com/dos.png',
        ]);
        expect(project.authors[0].url).toBe(`${SITE_URL}/member/pablo`);
        expect(project.authors[0].avatar).toBe(`${SITE_URL}/api/images/user-uploaded-images/cara.jpg`);
    });

    it('credits the people without an account too, with no link to nowhere', () => {
        const [pablo, llacer] = publicProject(row(), null).authors;

        expect(pablo).toMatchObject({ name: 'Pablo Estornut', role: 'código', handle: 'pablo' });
        expect(llacer).toMatchObject({ name: 'Llacer', role: '3D', handle: null, url: null, avatar: null });
    });

    it('keeps the order the author arranged the credits in', () => {
        expect(publicProject(row(), null).authors.map((a) => a.name))
            .toEqual(['Pablo Estornut', 'Llacer']);
    });

    it('answers in the language asked for, and says which one that was', () => {
        const english = publicProject(row(), 'en');

        expect(english.summary).toBe('A comic');
        expect(english.content).toBe('# Money Grass\n\nLong text.');
        expect(english.readingLang).toBe('en');
        // A project is called what it is called, in every language.
        expect(english.title).toBe('Money Grass');
    });

    it('falls back to how it was written rather than failing', () => {
        const klingon = publicProject(row(), 'tlh');

        expect(klingon.summary).toBe('Un cómic');
        expect(klingon.readingLang).toBe('es');
        expect(klingon.availableLangs).toEqual(['es', 'en']);
    });

    it('leaves the body text out of a listing', () => {
        expect(publicProject(row(), null, { content: false }).content).toBeUndefined();
        expect(publicProject(row(), null, { content: true }).content).toContain('Texto largo');
    });

    it('never lets an internal field out', () => {
        const project = publicProject(row(), null) as Record<string, unknown>;

        for (const field of ['createdById', 'canEdit', 'published', 'translations', 'thumbnail', 'videoUrl']) {
            expect(project, field).not.toHaveProperty(field);
        }
    });

    it('gives dates as text, because JSON has none', () => {
        const project = publicProject(row(), null);

        expect(project.startedAt).toBe('2025-03-01T00:00:00.000Z');
        expect(project.endedAt).toBeNull();
        expect(typeof project.updatedAt).toBe('string');
    });

    it('drops a screenshot it cannot address instead of leaving a hole', () => {
        const project = publicProject(row({ screenshots: ['/uno.jpg', '', '//ajeno.com/dos.png'] }), null);

        expect(project.screenshots).toEqual([`${SITE_URL}/uno.jpg`]);
    });

    it('says the tags by name, which is what a reader wants', () => {
        expect(publicProject(row(), null).tags).toEqual(['comic', '3d']);
    });
});

describe('memberUrl and projectUrl', () => {
    it('build the pages the site actually serves', () => {
        expect(memberUrl('pablo')).toBe(`${SITE_URL}/member/pablo`);
        expect(projectUrl('money-grass')).toBe(`${SITE_URL}/portfolio/money-grass`);
    });

    it('has no member page for somebody without an account', () => {
        expect(memberUrl(null)).toBeNull();
        expect(memberUrl(undefined)).toBeNull();
    });
});

describe('readPaging', () => {
    it('answers with a page when asked for nothing', () => {
        expect(readPaging({})).toEqual({ limit: PAGE_DEFAULT, offset: 0 });
    });

    it('takes what was asked for', () => {
        expect(readPaging({ limit: '5', offset: '10' })).toEqual({ limit: 5, offset: 10 });
    });

    it('caps the page rather than letting one call ask for everything', () => {
        expect(readPaging({ limit: '5000' }).limit).toBe(PAGE_MAX);
    });

    // Somebody writing limit=all wants projects, not a lecture.
    it('falls back instead of refusing when the number makes no sense', () => {
        expect(readPaging({ limit: 'all' }).limit).toBe(PAGE_DEFAULT);
        expect(readPaging({ limit: '-3' }).limit).toBe(PAGE_DEFAULT);
        expect(readPaging({ limit: '0' }).limit).toBe(PAGE_DEFAULT);
        expect(readPaging({ offset: 'siguiente' }).offset).toBe(0);
        expect(readPaging({ offset: '-10' }).offset).toBe(0);
    });
});
