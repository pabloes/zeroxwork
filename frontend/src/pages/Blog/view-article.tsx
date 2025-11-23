import ReactMarkdown from 'react-markdown';
import {api} from "../../services/axios-setup";
import {useParams, Link} from 'react-router-dom';
import PageTitle from "../../components/PageTitle";
import {useAuth} from "../../context/AuthContext";
import {useNavigate} from 'react-router-dom';
import {useQuery} from "@tanstack/react-query";
import {getNameAvatarImage} from "../../services/get-name-avatar-image";
import DonateButton from "../../components/DonateButton";
import InlineArticleScriptRunner from "../../components/InlineArticleScriptRunner";
import {ROLE} from "../../constants/roles";

const LANG_NAMES: Record<string, string> = {
    'es': 'Español',
    'en': 'English',
    'pt-br': 'Português',
    'zh': '中文',
};

function getUserLang(): string {
    return localStorage.getItem('blogLang') || 'en';
}

const ArticlePage: React.FC = () => {
    const {user} = useAuth();
    const {id} = useParams<{ id: string }>();
    const navigate = useNavigate();
    // Fetch the article using useQuery
    const { data: article } = useQuery({
        queryKey: ['article', id], // Unique key based on the article ID
        queryFn: () => fetchArticleById(id as string), // Pass the id to the fetch function
    });

    const handleEditClick = ()=> {
        navigate(`/edit-article/${id}`)
    }

    // Get user's preferred language and check for translations
    const userLang = getUserLang();
    const articleLang = article?.lang;
    const hreflang = article?.hreflang || [];

    // Find if there's a translation in user's language
    const userLangTranslation = hreflang.find((h: {lang: string, slug: string}) => h.lang === userLang);
    const showTranslationAvailable = article && articleLang !== userLang && userLangTranslation;

    // Check if this is a translation
    const isTranslation = article?.isTranslation;
    const originalLang = article?.originalLang;
    const originalSlug = article?.originalSlug;

    return (
        <div className="uk-container uk-section">
            {user && (user?.role === ROLE.ADMIN || user?.userId === article?.userId) && (
                <button className="uk-button uk-button-primary" onClick={handleEditClick}>
                    Edit Article
                </button>
            )}

            {/* Translation notices */}
            {showTranslationAvailable && (
                <div className="uk-alert uk-alert-primary uk-margin-small-bottom" uk-alert="">
                    This article has a translation in your language ({LANG_NAMES[userLang] || userLang}).{' '}
                    <Link to={`/view-article/${userLangTranslation.slug}`}>
                        Read in {LANG_NAMES[userLang] || userLang}
                    </Link>
                </div>
            )}

            {isTranslation && originalLang && originalSlug && originalLang !== userLang && (
                <div className="uk-alert uk-alert-warning uk-margin-small-bottom" uk-alert="">
                    This article is a translation. Original in {LANG_NAMES[originalLang] || originalLang}:{' '}
                    <Link to={`/view-article/${originalSlug}`}>
                        View original
                    </Link>
                </div>
            )}

            {article ? (
                <div className="uk-card uk-card-default uk-card-body markdown-body">
                    <p className="uk-text-meta">
                        <b>Published on:&nbsp;</b>{new Date(article.createdAt).toLocaleDateString()}&nbsp;|&nbsp;
                        <b>Last update:&nbsp;</b>{new Date(article.updatedAt).toLocaleDateString()}&nbsp;|&nbsp;
                        <b>Author:</b>&nbsp;<img
                        src={getNameAvatarImage({name:article.author, address:article.authorAddress })}
                        alt="Author Avatar"
                        className="uk-border-circle"
                        style={{ width: '32px', height: '32px', marginRight: '10px', float:"none", marginLeft:"6px" }}
                    />{article.author}
                    </p>
                    <PageTitle title={article.title}/>
                    <div id="article-content">
                        <ReactMarkdown>{article.content}</ReactMarkdown>
                    </div>
                    {article.script && (
                        <InlineArticleScriptRunner
                            code={article.script}
                            targetSelector="#article-content"
                        />
                    )}
                    <div>
                        {article.authorAddress && <div className="uk-card uk-card-default">
                            Make a donation to the author of this article:<br/>
                            <DonateButton donationAddress={article.authorAddress} />
                        </div>}
                    </div>
                </div>
            ) : (
                <p>Loading...</p>
            )}
        </div>
    );
};

export default ArticlePage;

async function fetchArticleById (idOrSlug: string) {
    // Check if it's a numeric ID or a slug
    const isNumeric = /^\d+$/.test(idOrSlug);
    const endpoint = isNumeric
        ? `/blog/articles/${idOrSlug}`
        : `/blog/articles/by-slug/${idOrSlug}`;

    const response = await api.get(endpoint);

    // Handle 301 redirect
    if (response.data.redirect && response.data.slug) {
        window.location.href = `/view-article/${response.data.slug}`;
        return null;
    }

    // Handle link-type articles - redirect to external URL
    if (response.data.type === 'link' && response.data.redirectUrl) {
        window.location.href = response.data.redirectUrl;
        return null;
    }

    return response.data;
}