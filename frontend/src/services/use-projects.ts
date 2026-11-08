import { useQuery } from "@tanstack/react-query";
import { api } from "./axios-setup";
import { useTranslation } from "../i18n";
import { articleExcerpt, type ArticleCredit, type ArticleTag } from "./use-articles";

/**
 * Portfolio items, which are no longer articles with a category on them.
 *
 * A project has no author: it has members, at least one, and each of them links
 * to their member page when there is an account behind the name. Its address is
 * /portfolio/<slug>, and /portfolio/<id> works too and always will.
 */
export interface ProjectMember extends ArticleCredit {}

export interface Project {
    id: number;
    slug: string;
    title: string;
    summary: string | null;
    content: string;
    lang: string;
    thumbnail: string;
    screenshots: string[];
    videoUrl: string | null;
    /** Where to go see or play the thing itself. */
    siteUrl: string | null;
    /** A GitHub or GitLab repository, when the project is open. */
    repoUrl: string | null;
    startedAt: string | null;
    endedAt: string | null;
    status: string | null;
    published: boolean;
    featured: boolean;
    tags: ArticleTag[];
    members: ProjectMember[];
    createdAt: string;
    updatedAt: string;
    /** The language this copy actually came back in. */
    readingLang: string;
    availableLangs: string[];
}

/** Where a project lives. The slug when it has one, the id as the fallback. */
export function projectPath(project: Pick<Project, 'id' | 'slug'>): string {
    return `/portfolio/${project.slug || project.id}`;
}

/**
 * The line under the title on a card. A project can carry its own summary; when
 * it does not, the opening of the body stands in, cut the same way an article's
 * excerpt is so the two read alike.
 */
export function projectExcerpt(project: Project, maxChars = 150): string {
    const own = (project.summary ?? '').trim();
    if (own !== '') return own;
    return articleExcerpt({ id: project.id, title: project.title, content: project.content } as any, maxChars);
}

export function useProjects() {
    const { lang } = useTranslation();

    return useQuery<Project[]>({
        queryKey: ['projects', lang],
        queryFn: async () => (await api.get(`/projects?lang=${lang}`)).data,
    });
}

export function useProject(idOrSlug: string) {
    const { lang } = useTranslation();

    return useQuery<Project>({
        queryKey: ['project', idOrSlug, lang],
        queryFn: async () => (await api.get(`/projects/${idOrSlug}?lang=${lang}`)).data,
        retry: false,
    });
}
