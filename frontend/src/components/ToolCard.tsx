import { Link } from 'react-router-dom';
import { articlePath, type Article } from "../services/use-articles";
import { useTranslation } from "../i18n";

const ACCENTS = ['var(--zx-blue)', 'var(--zx-orange)', 'var(--zx-mint)', 'var(--zx-red)', 'var(--zx-cyan)'];

const ToolCard: React.FC<{ tool: Article; index?: number }> = ({ tool, index = 0 }) => {
    const { t } = useTranslation();
    const tags = (tool.tags ?? []).map((tag) => tag.name).slice(0, 3).join(' · ');

    return (
        <Link
            to={articlePath(tool)}
            className="zx-tool"
            style={{ '--zx-accent': ACCENTS[index % ACCENTS.length] } as React.CSSProperties}
        >
            <div className="zx-tool-top">
                <span className="zx-tool-ic">
                    {tool.thumbnail
                        ? <img src={tool.thumbnail} alt="" loading="lazy" />
                        : (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14.7 6.3a4 4 0 0 1 5 5L16 15l-7 7-4-4 7-7 2.7-4.7z" />
                            </svg>
                        )}
                </span>
                <span className="zx-tool-live">● {t('common.live')}</span>
            </div>
            <h3>{tool.title}</h3>
            <span className="zx-tool-tags">{tags}</span>
            <span className="zx-tool-go">{t('common.open')} →</span>
        </Link>
    );
};

export default ToolCard;
