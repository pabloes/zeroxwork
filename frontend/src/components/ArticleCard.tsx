import { Link } from 'react-router-dom';
import { getNameAvatarImage } from "../services/get-name-avatar-image";
import { articlePath, type Article } from "../services/use-articles";
import { useTranslation } from "../i18n";

const ArticleCard: React.FC<{ article: Article }> = ({ article }) => {
    const { lang, t } = useTranslation();
    const date = new Date(article.createdAt).toLocaleDateString(lang === 'pt-br' ? 'pt-BR' : lang);

    return (
        <Link to={articlePath(article)} className="zx-post">
            <div className={`zx-post-thumb${article.thumbnail ? '' : ' zx-post-thumb-empty'}`}>
                {article.thumbnail
                    ? <img src={article.thumbnail} alt="" loading="lazy" />
                    : <span>ZEROxWORK</span>}
            </div>
            <div className="zx-post-body">
                <span className="zx-post-meta">
                    {article.authorAddress && (
                        <img
                            src={getNameAvatarImage({ name: article.author as string, address: article.authorAddress })}
                            alt=""
                        />
                    )}
                    {article.author && article.author !== 'Anonymous' ? `${article.author} · ` : ''}{date}
                </span>
                <h3>{article.title}</h3>
                <span className="zx-tool-go">{t('common.read')} →</span>
            </div>
        </Link>
    );
};

export default ArticleCard;
