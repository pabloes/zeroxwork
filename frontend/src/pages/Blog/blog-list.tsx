import { useTranslation } from "../../i18n";
import { useArticles } from "../../services/use-articles";
import ArticleCard from "../../components/ArticleCard";

const BlogIndex: React.FC = () => {
    const { t } = useTranslation();
    const { data: articles = [], isLoading } = useArticles('blog');

    return (
        <div className="zx-wrap zx-page">
            <div className="zx-page-head">
                <div className="zx-eyebrow" style={{ color: 'var(--zx-blue)' }}>{t('nav.blog')}</div>
                <h1 className="zx-sec-title">{t('blog.title')}</h1>
                <p className="zx-sec-sub">{t('blog.sub')}</p>
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
