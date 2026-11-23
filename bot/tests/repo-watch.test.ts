import { describe, it, expect } from 'vitest';
import type { RepoCommit, RepoFile, RepoRange } from '../src/github.js';
import {
    DISCORD_LIMIT,
    assess,
    buildTemplatePost,
    isDue,
    isMergeCommit,
    isNoiseFile,
    parseGitHubRepo,
    TEMPLATE_MAX_BULLETS,
    windowLabel,
} from '../src/repo-watch.js';

function commit(subject: string, date = '2026-11-05T18:00:00Z'): RepoCommit {
    return { sha: subject.slice(0, 7), subject, body: '', author: 'pabloes', date };
}

function file(filename: string, additions = 10, deletions = 5): RepoFile {
    return { filename, status: 'modified', additions, deletions };
}

function range(commits: RepoCommit[], files: RepoFile[]): RepoRange {
    return {
        repo: 'pabloes/x-race',
        branch: 'main',
        baseSha: 'base',
        headSha: 'head',
        commits,
        files,
        truncated: false,
        since: commits[0]?.date ?? '',
        until: commits[commits.length - 1]?.date ?? '',
    };
}

describe('parseGitHubRepo', () => {
    it('reads the repository out of a portfolio item url', () => {
        expect(parseGitHubRepo('https://github.com/pabloes/x-race')).toBe('pabloes/x-race');
        expect(parseGitHubRepo('https://github.com/pabloes/x-race/')).toBe('pabloes/x-race');
        expect(parseGitHubRepo('https://github.com/pabloes/x-race.git')).toBe('pabloes/x-race');
        expect(parseGitHubRepo('  https://github.com/pabloes/portal-lake  ')).toBe('pabloes/portal-lake');
    });

    it('ignores a repository the watcher cannot read', () => {
        // the portfolio accepts GitLab too; that project simply gets no devlog
        expect(parseGitHubRepo('https://gitlab.com/pabloes/x-race')).toBeNull();
        expect(parseGitHubRepo('https://github.com/pabloes')).toBeNull();
        expect(parseGitHubRepo('not a url')).toBeNull();
        expect(parseGitHubRepo(null)).toBeNull();
        expect(parseGitHubRepo('')).toBeNull();
    });
});

describe('isNoiseFile', () => {
    it('treats documentation and tooling as noise', () => {
        for (const path of [
            'design/gdd.md', 'design/gdd.pdf', 'docs/design/cover.png', 'README.md',
            'package-lock.json', '.github/workflows/deploy.yml', '.gitignore',
        ]) {
            expect(isNoiseFile(path), path).toBe(true);
        }
    });

    it('leaves the game alone', () => {
        for (const path of ['src/race.ts', 'server/src/physics.ts', 'assets/track.glb', 'src/hud/speed.tsx']) {
            expect(isNoiseFile(path), path).toBe(false);
        }
    });
});

describe('isMergeCommit', () => {
    it('knows a merge carries no news of its own', () => {
        expect(isMergeCommit("Merge branch 'claude/ui-restyle-b5faed'")).toBe(true);
        expect(isMergeCommit('Merge pull request #12 from pabloes/dev')).toBe(true);
        expect(isMergeCommit('Merge the lobby and the race HUD into one card')).toBe(false);
    });
});

describe('assess', () => {
    // The real week of 29 Oct - 5 Nov in pabloes/x-race: three commits, all of
    // them the GDD. This is the case a naive watcher gets wrong.
    it('does not announce a week that only wrote documentation', () => {
        const result = assess(range(
            [
                commit('Design folder at the root: GDD, visual deck, Season 01 proposal and its images'),
                commit('GDD: concept images from the Season 01 proposal'),
                commit('Visual GDD: drop the catalog detail pages, the full reference pages stay'),
            ],
            [
                file('design/gdd.md', 241, 0), file('design/gdd.pdf'), file('docs/design/cover.png'),
                file('design/reference/gdd-template.md', 347, 0),
            ],
        ));

        expect(result.worthPosting).toBe(false);
        expect(result.reason).toContain('documentation');
        expect(result.codeFiles).toHaveLength(0);
    });

    it('announces a week that changed the game', () => {
        const result = assess(range(
            [
                commit('Rename game to ELON RACE and fix race recovery and mobile HUD'),
                commit('Records on /stats: best laps and races per circuit'),
                commit('Solid barriers: laid by the generator, colliders on the server'),
            ],
            [file('src/race.ts', 120, 40), file('src/hud.tsx', 80, 10), file('README.md', 5, 1)],
        ));

        expect(result.worthPosting).toBe(true);
        expect(result.codeFiles).toHaveLength(2);
        expect(result.noiseFiles).toHaveLength(1);
        expect(result.codeLines).toBe(250);
    });

    it('drops merge commits before deciding there is anything to say', () => {
        const result = assess(range(
            [commit("Merge branch 'claude/ui-restyle'"), commit('Merge pull request #3 from pabloes/dev')],
            [file('src/race.ts', 200, 100)],
        ));

        expect(result.worthPosting).toBe(false);
        expect(result.reason).toContain('merge');
    });

    it('stays quiet for a change too small to be worth a post', () => {
        const result = assess(range([commit('Fix a typo in the lobby label')], [file('src/lobby.ts', 1, 1)]));
        expect(result.worthPosting).toBe(false);
        expect(result.reason).toContain('too small');
    });

    it('says why a week GitHub cut short reports no lines', () => {
        // The real Golfcraft week of 30 Oct - 6 Nov: 94 commits over 300 files,
        // which GitHub returns with every line count at zero.
        const wide = range(
            [commit('Ranked with friends: the room plays at the host level')],
            Array.from({ length: 120 }, (_, i) => file(`scene/src/part-${i}.ts`, 0, 0)),
        );
        wide.truncated = true;
        const result = assess(wide);

        expect(result.worthPosting).toBe(true);
        expect(result.codeLines).toBe(0);
        expect(result.reason).toContain('too wide for GitHub');
        expect(result.reason).not.toContain('0 line(s) of code');
    });

    it('keeps the partial count when GitHub returned one', () => {
        // The real Portal Lake week of 6-13 Nov: cut short at 300 files, but
        // the files it did return carry genuine counts. "At least" is the
        // honest word for that; hiding the number would lose real information.
        const wide = range(
            [commit('Seven rarities and the portal visitors')],
            [file('scene/src/fish.ts', 3000, 2197), ...Array.from({ length: 10 }, (_, i) => file(`scene/src/a-${i}.ts`, 0, 0))],
        );
        wide.truncated = true;
        const result = assess(wide);

        expect(result.worthPosting).toBe(true);
        expect(result.reason).toContain('at least 5197 line(s)');
        expect(result.reason).toContain('cut short by GitHub');
    });

    it('counts a wide change as substantial even when it is few lines', () => {
        const result = assess(range(
            [commit('Rename the boost pad across the scene')],
            [file('src/a.ts', 2, 2), file('src/b.ts', 2, 2), file('src/c.ts', 2, 2)],
        ));
        expect(result.worthPosting).toBe(true);
    });
});

describe('windowLabel', () => {
    it('writes a week inside one month', () => {
        expect(windowLabel('2026-10-21T10:00:00Z', '2026-10-28T10:00:00Z')).toBe('21 – 28 Oct');
    });

    it('names both months when the week straddles them', () => {
        expect(windowLabel('2026-10-29T10:00:00Z', '2026-11-05T10:00:00Z')).toBe('29 Oct – 5 Nov');
    });

    it('says one date when everything landed on one day', () => {
        expect(windowLabel('2026-11-05T18:28:36Z', '2026-11-05T18:34:54Z')).toBe('5 Nov');
    });
});

describe('buildTemplatePost', () => {
    const base = range(
        [commit('Records on /stats'), commit('Solid barriers')],
        [file('src/race.ts', 120, 40)],
    );

    it('is a post the channel will accept', () => {
        const post = buildTemplatePost({
            gameName: 'ELON RACE',
            range: base,
            assessment: assess(base),
            siteUrl: 'https://decentraland.org/jump/?realm=xrace.dcl.eth',
        });

        expect(post).toContain('**ELON RACE · devlog');
        expect(post).toContain('• Records on /stats');
        expect(post).toContain('xrace.dcl.eth');
        expect(post.length).toBeLessThanOrEqual(DISCORD_LIMIT);
    });

    it('shows the newest changes, not the week\'s first ones', () => {
        // The real Claim Bite week of 13-19 Nov, in the order GitHub returns
        // it: oldest first. Filling from the front printed the opening commits
        // and cut the ones that landed last, which are what a reader came for.
        const subjects = [
            'Fix slot-machines position', 'Add Russian lang support', 'Add Vietnam language',
            'Add Soundtrack controls', 'Improve casino UI', 'Optimize textures',
            'Share texture between asset-packs', 'Improve Houses', 'improve notifications',
            'New ranches, improve message system, fix house bug on mobile',
        ];
        const busy = range(subjects.map((s) => commit(s)), [file('src/game.ts', 500, 200)]);
        const post = buildTemplatePost({ gameName: 'Claim Bite', range: busy, assessment: assess(busy) });

        expect(post).toContain('New ranches, improve message system');
        expect(post).toContain('improve notifications');
        // the week opened with these, and they are no longer what it leads on
        expect(post).not.toContain('Fix slot-machines position');
        expect(post).not.toContain('Add Russian lang support');
    });

    it('stops at six bullets however long the week was', () => {
        const subjects = Array.from({ length: 40 }, (_, i) => commit(`Change number ${i}`));
        const busy = range(subjects, [file('src/game.ts', 500, 200)]);
        const post = buildTemplatePost({ gameName: 'Claim Bite', range: busy, assessment: assess(busy) });

        const bullets = post.split('\n').filter((line) => line.startsWith('• '));
        // six changes plus the line that counts the rest
        expect(bullets).toHaveLength(TEMPLATE_MAX_BULLETS + 1);
        expect(post).toContain('…and 34 more changes');
    });

    it('counts one leftover change in the singular', () => {
        const subjects = Array.from({ length: TEMPLATE_MAX_BULLETS + 1 }, (_, i) => commit(`Change ${i}`));
        const busy = range(subjects, [file('src/game.ts', 500, 200)]);
        const post = buildTemplatePost({ gameName: 'Claim Bite', range: busy, assessment: assess(busy) });
        expect(post).toContain('…and 1 more change');
        expect(post).not.toContain('1 more changes');
    });

    it('says nothing about leftovers when there are none', () => {
        const small = range([commit('Records on /stats'), commit('Solid barriers')], [file('src/race.ts', 120, 40)]);
        const post = buildTemplatePost({ gameName: 'ELON RACE', range: small, assessment: assess(small) });
        expect(post).not.toContain('more change');
    });

    it('fits a very busy week into one message', () => {
        const many = Array.from({ length: 200 }, (_, index) => commit(`A change with a fairly long subject line, number ${index}`));
        const busy = range(many, [file('src/race.ts', 900, 300)]);
        const post = buildTemplatePost({ gameName: 'ELON RACE', range: busy, assessment: assess(busy) });

        expect(post.length).toBeLessThanOrEqual(DISCORD_LIMIT);
        expect(post).toContain('more');
    });
});

describe('isDue', () => {
    const now = new Date('2026-11-21T20:00:00Z');

    it('is due when nothing has ever been checked', () => {
        expect(isDue(null, now)).toBe(true);
    });

    it('waits out the week, and a restart does not change that', () => {
        expect(isDue(new Date('2026-11-20T20:00:00Z'), now)).toBe(false);
        expect(isDue(new Date('2026-11-14T19:00:00Z'), now)).toBe(true);
    });
});
