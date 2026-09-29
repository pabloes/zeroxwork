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
    author?: string;
    authorAddress?: string;
    tags?: ArticleTag[];
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
