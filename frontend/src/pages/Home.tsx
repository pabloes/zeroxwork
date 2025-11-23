import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/axios-setup';
import { useQuery } from "@tanstack/react-query";
import { getNameAvatarImage } from "../services/get-name-avatar-image";

const SUPPORTED_LANGS = ['es', 'en', 'pt-br', 'zh'] as const;
type SupportedLang = typeof SUPPORTED_LANGS[number];

function normalizeLang(l: string): string {
    return l.toLowerCase().replace('_', '-');
}

function detectBrowserLang(): SupportedLang {
    const langs = (navigator.languages?.length ? navigator.languages : [navigator.language]).map(normalizeLang);

    for (const l of langs) {
        // Map any Portuguese variant to pt-br
        if (l === 'pt-pt' || l.startsWith('pt-')) return 'pt-br';
        if (SUPPORTED_LANGS.includes(l as SupportedLang)) return l as SupportedLang;
        const base = l.split('-')[0];
        if (SUPPORTED_LANGS.includes(base as SupportedLang)) return base as SupportedLang;
    }
    return 'en';
}

function getEffectiveLang(): SupportedLang {
    const saved = localStorage.getItem('blogLang');
    if (saved && SUPPORTED_LANGS.includes(saved as SupportedLang)) {
        return saved as SupportedLang;
    }
    return detectBrowserLang();
}

interface Article {
    id: number;
    title: string;
    slug?: string;
    thumbnail: string | null;
    createdAt: string;
    authorAddress?: string;
    author?: string;
}

const HomeDashboard: React.FC = () => {
    const [lang, setLang] = useState<SupportedLang>(getEffectiveLang());

    const { data: articles = [] } = useQuery({
        queryKey: ['articles', lang],
        queryFn: () => fetchArticles(lang),
    });

    // Listen for language changes from Header
    useEffect(() => {
        const handleLangChange = (e: CustomEvent<SupportedLang>) => {
            setLang(e.detail);
        };
        window.addEventListener('langChange', handleLangChange as EventListener);
        return () => {
            window.removeEventListener('langChange', handleLangChange as EventListener);
        };
    }, []);

    return (
        <div className="uk-container uk-margin-large-top">

            <div className="uk-grid uk-flex-center" uk-grid="true">
                {articles.map((article: Article) => (
                    <div className="uk-flex uk-width-1-2@m uk-width-1-2@s" key={article.id}>
                        <Link
                            to={article.slug ? `/view-article/${article.slug}` : `/view-article/${article.id}`}
                            className="uk-link-reset uk-flex-first"
                        >
                            <div className="uk-card uk-card-hover">
                                <div className="uk-cover-container">
                                    {article.thumbnail ? (
                                        <img
                                            src={article.thumbnail}
                                            alt={article.title}
                                            data-uk-cover
                                        />
                                    ) : (
                                        <div className="uk-placeholder">No image available</div>
                                    )}
                                    <canvas width="600" height="400"></canvas>

                                    <div className="uk-overlay uk-overlay-primary uk-position-bottom uk-light">
                                        <h3 className="uk-card-title">{article.title}</h3>
                                        {article.authorAddress && <div className="uk-text-meta">
                                        <img
                                            src={getNameAvatarImage({
                                                name: article!.author as string,
                                                address: article!.authorAddress as string
                                            })}
                                            alt="Author Avatar"
                                            className="uk-border-circle"
                                            style={{ width: '32px', height: '32px', marginRight: '10px', float: "none" }}
                                        />{article.author}  |  {new Date(article.createdAt).toLocaleDateString()}
                                        </div> || null}
                                    </div>
                                </div>
                            </div>
                        </Link>
                    </div>
                ))}
            </div>
        </div>
    );

    async function fetchArticles(lang: string) {
        const response = await api.get(`/blog/articles?lang=${lang}`);
        return response.data;
    }
};

export default HomeDashboard;
