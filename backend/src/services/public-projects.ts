/**
 * The portfolio as somebody outside the site sees it.
 *
 * This is deliberately not the shape /api/projects answers with. That one is
 * written for our own pages: it carries `canEdit`, it says `thumbnail` because
 * that is the column's name, and it changes whenever the portfolio page needs
 * something else. The moment a stranger builds against a shape, changing it
 * breaks them, so the public API gets its own: whole addresses instead of
 * paths, the words a reader would use, and nothing about who may edit what.
 *
 * Everything here is a pure function of a row, so it can be read and tested
 * without a database.
 */

import { resolvePublicName } from '../config/public-name.js';
import { SITE_URL, absoluteUrl } from '../config/site.js';

/** What the public API reads. Anything not listed here cannot leak out of it. */
export const PUBLIC_PROJECT_SELECT = {
    id: true, slug: true, title: true, summary: true, content: true, lang: true,
    thumbnail: true, screenshots: true, videoUrl: true, siteUrl: true, repoUrl: true,
    startedAt: true, endedAt: true, status: true, featured: true,
    createdAt: true, updatedAt: true,
    tags: { select: { id: true, name: true } },
    members: {
        select: {
            name: true, role: true, position: true, userId: true,
            user: {
                select: {
                    id: true, handle: true, displayName: true, avatarUrl: true,
                    discordLink: { select: { globalName: true, username: true } },
                    defaultName: { select: { name: true } },
                },
            },
        },
        orderBy: { position: 'asc' as const },
    },
    translations: {
        select: { targetLang: true, title: true, summary: true, content: true },
    },
} as const;

/** The row this module turns into an answer. Mirrors PUBLIC_PROJECT_SELECT. */
export interface ProjectRow {
    id: number;
    slug: string;
    title: string;
    summary: string | null;
    content: string;
    lang: string;
    thumbnail: string;
    screenshots: string[];
    videoUrl: string | null;
    siteUrl: string | null;
    repoUrl: string | null;
    startedAt: Date | null;
    endedAt: Date | null;
    status: string | null;
    featured: boolean;
    createdAt: Date;
    updatedAt: Date;
    tags: { id: number; name: string }[];
    members: {
        name: string;
        role: string | null;
        position: number;
        userId: number | null;
        user: {
            id: number;
            handle: string | null;
            displayName: string | null;
            avatarUrl: string | null;
            discordLink?: { globalName: string | null; username: string | null } | null;
            defaultName?: { name: string | null } | null;
        } | null;
    }[];
    translations: { targetLang: string; title: string | null; summary: string | null; content: string | null }[];
}

/**
 * Somebody who worked on the project. `url` is their member page when they
 * have an account here, and null when the credit is just a name -- which is
 * allowed on purpose: not everybody who makes something has to sign up for it.
 */
export interface PublicAuthor {
    name: string;
    role: string | null;
    handle: string | null;
    url: string | null;
    avatar: string | null;
}

export interface PublicProject {
    id: number;
    slug: string;
    url: string;
    title: string;
    summary: string | null;
    /** Markdown, as it was written. Only in the single-project answer. */
    content?: string;
    lang: string;
    readingLang: string;
    availableLangs: string[];
    status: string | null;
    featured: boolean;
    startedAt: string | null;
    endedAt: string | null;
    createdAt: string;
    updatedAt: string;
    cover: string | null;
    screenshots: string[];
    video: string | null;
    siteUrl: string | null;
    repoUrl: string | null;
    tags: string[];
    authors: PublicAuthor[];
}

/** A member page address, for the people who have an account here. */
export function memberUrl(handle: string | null | undefined): string | null {
    return handle ? `${SITE_URL}/member/${handle}` : null;
}

/** A portfolio page address. The slug is the one in use right now. */
export function projectUrl(slug: string): string {
    return `${SITE_URL}/portfolio/${slug}`;
}

function authors(members: ProjectRow['members']): PublicAuthor[] {
    return members.map((member) => ({
        name: member.user ? resolvePublicName(member.user) : member.name,
        role: member.role,
        handle: member.user?.handle ?? null,
        url: memberUrl(member.user?.handle),
        avatar: absoluteUrl(member.user?.avatarUrl),
    }));
}

/** An instant as a string, because JSON has no date and a reader needs one. */
const iso = (value: Date | null | undefined) => (value ? new Date(value).toISOString() : null);

/**
 * One project.
 *
 * `lang` picks which stored translation fills the prose; the title is never
 * translated, because a project is called what it is called. Asking for a
 * language we do not have falls back to how it was written rather than failing,
 * and `readingLang` says which one came back, so the caller never has to guess.
 */
export function publicProject(
    project: ProjectRow,
    lang: string | null,
    options: { content: boolean } = { content: true },
): PublicProject {
    const wanted = (lang ?? '').trim().toLowerCase();
    const translation = wanted && wanted !== project.lang.toLowerCase()
        ? project.translations.find((t) => t.targetLang.toLowerCase() === wanted)
        : undefined;

    const shaped: PublicProject = {
        id: project.id,
        slug: project.slug,
        url: projectUrl(project.slug),
        title: project.title,
        summary: translation?.summary ?? project.summary,
        lang: project.lang,
        readingLang: translation ? translation.targetLang : project.lang,
        availableLangs: [project.lang, ...project.translations.map((t) => t.targetLang)],
        status: project.status,
        featured: project.featured,
        startedAt: iso(project.startedAt),
        endedAt: iso(project.endedAt),
        createdAt: iso(project.createdAt) as string,
        updatedAt: iso(project.updatedAt) as string,
        cover: absoluteUrl(project.thumbnail),
        // A broken address is dropped rather than sent as null in the middle of
        // the list: a gallery of three with a hole in it is worse than two.
        screenshots: project.screenshots.map(absoluteUrl).filter((url): url is string => url !== null),
        video: project.videoUrl,
        siteUrl: project.siteUrl,
        repoUrl: project.repoUrl,
        tags: project.tags.map((tag) => tag.name),
        authors: authors(project.members),
    };

    // The body of a project is long, and a list of thirty of them would be
    // mostly prose nobody asked for. It comes with the single project.
    if (options.content) shaped.content = translation?.content ?? project.content;

    return shaped;
}
