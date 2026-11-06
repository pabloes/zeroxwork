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
    thumbnail: string | null;
    createdAt: string;
    /** Default wallet name, or 'Anonymous'. Drives the dcl/base avatars. */
    author?: string;
    authorAddress?: string;
    /** Optional public name the author set on /account. */
    authorDisplayName?: string | null;
    /** Optional avatar the author uploaded on /account. */
    authorAvatar?: string | null;
    tags?: ArticleTag[];
}

/** Public name for an author: their display name, else the wallet name, else nothing. */
export function authorLabel(article: Pick<Article, 'author' | 'authorDisplayName'>): string | null {
    if (article.authorDisplayName) return article.authorDisplayName;
    if (article.author && article.author !== 'Anonymous') return article.author;
    return null;
}

export type ArticleCategory = 'blog' | 'tool';

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
