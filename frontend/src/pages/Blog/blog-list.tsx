import { Link } from "react-router-dom";
import { useTranslation } from "../../i18n";
import { useAuth } from "../../context/AuthContext";
import { useArticles } from "../../services/use-articles";
import ArticleCard from "../../components/ArticleCard";

const BlogIndex: React.FC = () => {
    const { t } = useTranslation();
    const { data: articles = [], isLoading } = useArticles('blog');
    // Waiting for isAuthResolved too: isAuthenticated starts false while the
    // stored token is read, and without it the button flashes in and out.
    const { isAuthenticated, isAuthResolved } = useAuth();

    return (
        <div className="zx-wrap zx-page">
            <div className="zx-row-head">
                <div>
                    <div className="zx-eyebrow" style={{ color: 'var(--zx-blue)' }}>{t('nav.blog')}</div>
                    <h1 className="zx-sec-title">{t('blog.title')}</h1>
                    <p className="zx-sec-sub">{t('blog.sub')}</p>
                </div>

                {/* Members write the blog, so the way to write one belongs here
                    and not only behind /my-articles. */}
                {isAuthResolved && isAuthenticated && (
                    <Link className="zx-btn zx-btn-primary" to="/create-article">
                        {t('blog.create')} <span className="arr">→</span>
                    </Link>
                )}
            </div>

            {articles.length > 0 ? (
                <div className="zx-card-grid">
                    {articles.map((article) => (
                        <ArticleCard key={article.id} article={article} />
                    ))}
                </div>
            ) : (
                <div className="zx-empty">{isLoading ? t('common.loading') : t('common.empty')}</div>
            )}
        </div>
    );
};

export default BlogIndex;
