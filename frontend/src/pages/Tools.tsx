import { useTranslation } from "../i18n";
import { useArticles } from "../services/use-articles";
import ToolCard from "../components/ToolCard";

const ToolsPage: React.FC = () => {
    const { t } = useTranslation();
    const { data: tools = [], isLoading } = useArticles('tool');

    return (
        <div className="zx-wrap zx-page">
            <div className="zx-page-head">
                <div className="zx-eyebrow" style={{ color: 'var(--zx-ok)' }}>{t('nav.tools')}</div>
                <h1 className="zx-sec-title">{t('tools.title')}</h1>
                <p className="zx-sec-sub">{t('tools.sub')}</p>
            </div>

            {tools.length > 0 ? (
                <div className="zx-card-grid zx-cols-4">
                    {tools.map((tool, i) => (
                        <ToolCard key={tool.id} tool={tool} index={i} />
                    ))}
                </div>
            ) : (
                <div className="zx-empty">{isLoading ? t('common.loading') : t('common.empty')}</div>
            )}
        </div>
    );
};

export default ToolsPage;
