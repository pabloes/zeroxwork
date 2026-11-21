/**
 * The little slice of the GitHub API the devlog watcher needs.
 *
 * Everything here talks to the network. The decisions taken on what comes
 * back -- what counts as a change worth telling players about -- are pure and
 * live in repo-watch.ts.
 *
 * Authentication is optional: a public repository works without a token, at
 * 60 requests an hour per IP, which is plenty for a weekly pass. A private one
 * needs GITHUB_TOKEN, and so does a public one if the server ever shares its
 * IP with something noisy.
 */

const API = 'https://api.github.com';

/**
 * A generic client name on purpose: the User-Agent is sent to a third party
 * and is no place for whose repository this is.
 */
const USER_AGENT = 'zeroxwork-repo-watch';

export interface RepoCommit {
    sha: string;
    /** the first line of the message, which is what a devlog can use */
    subject: string;
    body: string;
    author: string;
    /** ISO 8601 */
    date: string;
}

export interface RepoFile {
    filename: string;
    status: string;
    additions: number;
    deletions: number;
}

export interface RepoRange {
    repo: string;
    branch: string;
    baseSha: string;
    headSha: string;
    commits: RepoCommit[];
    files: RepoFile[];
    /** GitHub caps a comparison at 250 commits and 300 files */
    truncated: boolean;
    /** the date of the oldest commit covered, ISO 8601 */
    since: string;
    /** the date of the newest commit covered, ISO 8601 */
    until: string;
}

export class GitHubError extends Error {
    constructor(message: string, readonly status: number) {
        super(message);
        this.name = 'GitHubError';
    }
}

async function get<T>(path: string, token: string | null): Promise<T> {
    const response = await fetch(`${API}${path}`, {
        headers: {
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': USER_AGENT,
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
    });

    if (!response.ok) {
        // 404 on a repository that exists is what a missing or too narrow
        // token looks like: GitHub hides a private repository rather than
        // admitting it is there.
        const hint = response.status === 404 && !token
            ? ' (private repositories need GITHUB_TOKEN)'
            : '';
        throw new GitHubError(`GitHub ${response.status} on ${path}${hint}`, response.status);
    }
    return await response.json() as T;
}

interface ApiCommit {
    sha: string;
    commit: { message: string; author: { name: string; date: string } | null };
}

function toCommit(raw: ApiCommit): RepoCommit {
    const lines = raw.commit.message.split('\n');
    return {
        sha: raw.sha,
        subject: lines[0].trim(),
        body: lines.slice(1).join('\n').trim(),
        author: raw.commit.author?.name ?? 'unknown',
        date: raw.commit.author?.date ?? '',
    };
}

export async function defaultBranch(repo: string, token: string | null): Promise<string> {
    const info = await get<{ default_branch: string }>(`/repos/${repo}`, token);
    return info.default_branch;
}

/** The newest commit on the branch, or null for a repository with none. */
export async function headCommit(repo: string, branch: string, token: string | null): Promise<RepoCommit | null> {
    const commits = await get<ApiCommit[]>(`/repos/${repo}/commits?sha=${encodeURIComponent(branch)}&per_page=1`, token);
    return commits.length ? toCommit(commits[0]) : null;
}

/**
 * The last commit at or before a moment, which is where a first run starts
 * from: the seven days before the newest commit, not the whole history.
 */
export async function commitBefore(
    repo: string,
    branch: string,
    isoDate: string,
    token: string | null,
): Promise<RepoCommit | null> {
    const query = `sha=${encodeURIComponent(branch)}&until=${encodeURIComponent(isoDate)}&per_page=1`;
    const commits = await get<ApiCommit[]>(`/repos/${repo}/commits?${query}`, token);
    return commits.length ? toCommit(commits[0]) : null;
}

interface ApiCompare {
    total_commits: number;
    commits: ApiCommit[];
    files?: RepoFile[];
}

/**
 * Everything that landed between two commits, in one request: GitHub's
 * comparison carries the commits and the changed files together.
 */
export async function compare(
    repo: string,
    base: string,
    head: string,
    token: string | null,
): Promise<{ commits: RepoCommit[]; files: RepoFile[]; truncated: boolean }> {
    const result = await get<ApiCompare>(
        `/repos/${repo}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}?per_page=250`,
        token,
    );
    const commits = result.commits.map(toCommit);
    const files = (result.files ?? []).map((file) => ({
        filename: file.filename,
        status: file.status,
        additions: file.additions ?? 0,
        deletions: file.deletions ?? 0,
    }));
    return {
        commits,
        files,
        truncated: result.total_commits > commits.length || files.length >= 300,
    };
}

/** How far back a repository nobody has reported on yet is read. */
export const FIRST_RUN_DAYS = 7;

/**
 * What landed since the last post. Returns null when there is nothing new,
 * which is the ordinary answer for a quiet week.
 */
export async function fetchRange(
    repo: string,
    branch: string | null,
    lastSha: string | null,
    token: string | null,
    firstRunDays = FIRST_RUN_DAYS,
): Promise<RepoRange | null> {
    const onBranch = branch ?? await defaultBranch(repo, token);
    const head = await headCommit(repo, onBranch, token);
    if (!head) return null;
    if (lastSha === head.sha) return null;

    let base = lastSha;
    if (!base) {
        // No post has ever gone out for this repository. Start from the week
        // before its newest commit rather than replaying its whole history: a
        // repository that has been quiet for a month still gets its last
        // active week, which is what a first devlog should cover.
        const windowStart = new Date(new Date(head.date).getTime() - firstRunDays * 86_400_000).toISOString();
        const before = await commitBefore(repo, onBranch, windowStart, token);
        // A repository younger than the window has no commit before it; the
        // empty tree hash compares against the very first commit.
        base = before?.sha ?? '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
    }

    const { commits, files, truncated } = await compare(repo, base, head.sha, token);
    if (commits.length === 0) return null;

    return {
        repo,
        branch: onBranch,
        baseSha: base,
        headSha: head.sha,
        commits,
        files,
        truncated,
        since: commits[0].date,
        until: commits[commits.length - 1].date,
    };
}
