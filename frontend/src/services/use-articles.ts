import { useQuery } from "@tanstack/react-query";
import { api } from "./axios-setup";
import { useTranslation } from "../i18n";

export interface ArticleTag {
    id: number;
    name: string;
}

export interface Article {
    id: number;
    title: string;
    slug?: string;
    content?: string | null;
    thumbnail: string | null;
    createdAt: string;
    author?: string;
    authorAddress?: string;
    tags?: ArticleTag[];
}

export type ArticleCategory = 'blog' | 'tool' | 'project';

/** Articles for the active UI language; refetches when the language changes. */
export function useArticles(category: ArticleCategory) {
    const { lang } = useTranslation();

    return useQuery<Article[]>({
        queryKey: [category, lang],
        queryFn: async () => {
            const response = await api.get(`/blog/articles?lang=${lang}&category=${category}`);
            return response.data;
        },
    });
}

export function articlePath(article: Article) {
    return `/view-article/${article.slug ?? article.id}`;
}

/** Plain-text opening of an article's markdown body, for card summaries. */
export function articleExcerpt(article: Article, maxChars = 150): string {
    const plain = (article.content ?? '')
        .replace(/```[\s\S]*?```/g, ' ')            // fenced code blocks
        .replace(/`([^`]*)`/g, '$1')                // inline code
        .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')       // images
        .replace(/\[([^\]]*)]\([^)]*\)/g, '$1')     // links keep their text
        .replace(/\[iframe]/gi, ' ')                // embed placeholder
        .replace(/<[^>]+>/g, ' ')                   // inline html
        .replace(/^\s{0,3}(#{1,6}|>+|[-*+]|\d+\.)\s+/gm, '') // block markers
        .replace(/[*_~]{1,3}/g, '')                 // emphasis
        .replace(/\s+/g, ' ')
        .trim();

    if (plain.length <= maxChars) return plain;
    const cut = plain.slice(0, maxChars);
    const lastSpace = cut.lastIndexOf(' ');
    return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** Unique tag names across a set of articles, alphabetically. */
export function collectTagNames(articles: Article[]): string[] {
    const names = new Set<string>();
    articles.forEach((article) => (article.tags ?? []).forEach((tag) => names.add(tag.name)));
    return [...names].sort((a, b) => a.localeCompare(b));
}
