/**
 * Deciding what a week of commits amounts to.
 *
 * All of it is pure: given a comparison from GitHub, is there anything here a
 * player would want to hear about, and what does the post say if the model
 * that writes it is unavailable. Anything touching GitHub, the database or
 * Discord lives in github.ts and repo-watch-run.ts.
 */

import type { RepoCommit, RepoFile, RepoRange } from './github.js';

/** Discord refuses a message longer than this. */
export const DISCORD_LIMIT = 2000;

/**
 * The repository comes from the portfolio item (`Project.repoUrl`), so it
 * arrives as whatever URL somebody typed there. Only GitHub is watched: the
 * portfolio also accepts GitLab, and that one simply never gets a devlog.
 */
export function parseGitHubRepo(url: string | null | undefined): string | null {
    if (!url) return null;
    let parsed: URL;
    try {
        parsed = new URL(url.trim());
    } catch {
        return null;
    }
    if (parsed.hostname !== 'github.com' && parsed.hostname !== 'www.github.com') return null;

    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return null;
    const [owner, name] = parts;
    const repo = `${owner}/${name.replace(/\.git$/, '')}`;
    return /^[\w.-]+\/[\w.-]+$/.test(repo) ? repo : null;
}

/**
 * Paths whose changes say nothing to a player. A week that only touches these
 * is a week with no devlog, however many commits it holds -- which is exactly
 * what a naive watcher gets wrong, announcing an update for three commits of
 * markdown.
 */
export const NOISE_PREFIXES = ['design/', 'docs/', 'doc/', '.github/', '.claude/', '.vscode/', 'scripts/ci/'];
export const NOISE_EXTENSIONS = ['.md', '.mdx', '.pdf', '.txt', '.lock'];
export const NOISE_FILES = [
    'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', '.gitignore', '.gitattributes',
    '.editorconfig', '.npmrc', '.nvmrc', 'license', 'license.txt', 'codeowners',
];

export function isNoiseFile(filename: string): boolean {
    const path = filename.toLowerCase();
    if (NOISE_PREFIXES.some((prefix) => path.startsWith(prefix))) return true;
    if (NOISE_EXTENSIONS.some((extension) => path.endsWith(extension))) return true;
    const base = path.split('/').pop() ?? path;
    return NOISE_FILES.includes(base);
}

/**
 * A merge carries no news of its own: whatever it brought in is already in the
 * comparison as the commits it merged.
 */
export function isMergeCommit(subject: string): boolean {
    return /^merge (branch|pull request|remote-tracking|commit)\b/i.test(subject.trim());
}

export interface Thresholds {
    /** changed lines outside the noise paths */
    minLines: number;
    /** changed files outside the noise paths */
    minFiles: number;
}

export const DEFAULT_THRESHOLDS: Thresholds = { minLines: 60, minFiles: 3 };

export interface Assessment {
    worthPosting: boolean;
    /** said in the log, and the only thing a quiet week leaves behind */
    reason: string;
    /** the commits a post can be written from: merges dropped */
    commits: RepoCommit[];
    codeFiles: RepoFile[];
    noiseFiles: RepoFile[];
    codeLines: number;
}

export function assess(range: RepoRange, thresholds: Thresholds = DEFAULT_THRESHOLDS): Assessment {
    const commits = range.commits.filter((commit) => !isMergeCommit(commit.subject));
    const codeFiles = range.files.filter((file) => !isNoiseFile(file.filename));
    const noiseFiles = range.files.filter((file) => isNoiseFile(file.filename));
    const codeLines = codeFiles.reduce((total, file) => total + file.additions + file.deletions, 0);

    const base = { commits, codeFiles, noiseFiles, codeLines };

    if (commits.length === 0) {
        return { ...base, worthPosting: false, reason: 'nothing but merge commits' };
    }
    if (codeFiles.length === 0) {
        return {
            ...base,
            worthPosting: false,
            reason: `${noiseFiles.length} file(s) changed, all of them documentation or tooling`,
        };
    }
    if (codeLines < thresholds.minLines && codeFiles.length < thresholds.minFiles) {
        return {
            ...base,
            worthPosting: false,
            reason: `only ${codeLines} line(s) across ${codeFiles.length} file(s): too small to announce`,
        };
    }

    // GitHub stops a comparison at 300 files, and a comparison it cut short
    // comes back with every line count at zero -- so a very busy week reads as
    // "0 lines of code" unless the reason says what happened. The decision
    // above is unaffected: a week that wide passes on its file count alone.
    const size = !range.truncated
        ? `${codeLines} line(s) of code`
        : codeLines > 0
            // partial counts: real, but only for the part GitHub returned
            ? `at least ${codeLines} line(s) across ${codeFiles.length} file(s), cut short by GitHub`
            : `${codeFiles.length} file(s) of code, too wide for GitHub to count the lines`;
    return { ...base, worthPosting: true, reason: `${commits.length} commit(s), ${size}` };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * "21 – 28 Oct", or "29 Oct – 5 Nov" when the week straddles two months, or
 * plain "5 Nov" when everything landed on one day -- which happens often
 * enough that "5 – 5 Nov" would be a recognisable bot tell.
 */
export function windowLabel(since: string, until: string): string {
    const from = new Date(since);
    const to = new Date(until);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return '';
    const fromMonth = MONTHS[from.getUTCMonth()];
    const toMonth = MONTHS[to.getUTCMonth()];
    if (fromMonth === toMonth && from.getUTCDate() === to.getUTCDate()) {
        return `${to.getUTCDate()} ${toMonth}`;
    }
    const left = fromMonth === toMonth ? `${from.getUTCDate()}` : `${from.getUTCDate()} ${fromMonth}`;
    return `${left} – ${to.getUTCDate()} ${toMonth}`;
}

export interface PostInput {
    gameName: string;
    range: RepoRange;
    assessment: Assessment;
    /** the portfolio item's own link, when it has one */
    siteUrl?: string | null;
}

/**
 * How many commit subjects the plain post shows before it stops counting.
 *
 * Six, because a wall of thirty-seven lines is not something anybody reads.
 * The template cannot do what a model does -- seven commits about languages
 * are one sentence about languages, and only something that understands them
 * can say so -- but it can at least refuse to print all seven.
 */
export const TEMPLATE_MAX_BULLETS = 6;

/**
 * The post written without a model: the commit subjects, as they are.
 *
 * It reads like a changelog rather than a devlog, which is the point -- it is
 * the fallback for when the key is missing or the API call fails, and a short
 * list of real changes is better than silence or an invention.
 */
export function buildTemplatePost(input: PostInput): string {
    const { gameName, range, assessment, siteUrl } = input;
    const header = `**${gameName} · devlog ${windowLabel(range.since, range.until)}**`;
    const footer = siteUrl ? `\n\n${siteUrl}` : '';

    // The newest, not the oldest. A comparison arrives oldest first, so filling
    // from the front printed the week's opening commits and cut the ones that
    // landed last -- which are the ones somebody reading a devlog came for.
    const newest = assessment.commits.slice(-TEMPLATE_MAX_BULLETS);
    const lines: string[] = [];
    for (const commit of newest) {
        const line = `• ${commit.subject}`;
        // a single enormous subject should still not blow the message
        if (header.length + lines.join('\n').length + line.length + footer.length > DISCORD_LIMIT - 60) break;
        lines.push(line);
    }

    const hidden = assessment.commits.length - lines.length;
    if (hidden > 0) lines.push(`• …and ${hidden} more change${hidden === 1 ? '' : 's'}`);

    return clampToDiscord(`${header}\n\n${lines.join('\n')}${footer}`);
}

export function clampToDiscord(text: string): string {
    const trimmed = text.trim();
    return trimmed.length <= DISCORD_LIMIT ? trimmed : `${trimmed.slice(0, DISCORD_LIMIT - 1)}…`;
}

export const WEEK_MS = 7 * 86_400_000;

/**
 * Paced by the database, not by a timer: the bot restarts on every deploy, and
 * an interval started at boot would either skip a week or fire on every one.
 */
export function isDue(lastCheckedAt: Date | null, now: Date, everyMs = WEEK_MS): boolean {
    if (!lastCheckedAt) return true;
    return now.getTime() - lastCheckedAt.getTime() >= everyMs;
}
