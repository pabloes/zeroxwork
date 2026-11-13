import { Link } from 'react-router-dom';
import { useTranslation } from "../i18n";
import { useAuth } from "../context/AuthContext";
import { useTools } from "../services/use-tools";
import ToolCard from "../components/ToolCard";

/**
 * /tools — el catálogo.
 *
 * Ya no lee artículos con la categoría "tool": lee herramientas, que es lo que
 * son. El botón de dar de alta sólo aparece a quien ha entrado, porque a quien
 * no, no le lleva a ningún sitio.
 */
const ToolsPage: React.FC = () => {
    const { t } = useTranslation();
    const { isAuthenticated } = useAuth();
    const { data: tools = [], isLoading } = useTools();

    return (
        <div className="zx-wrap zx-page">
            <div className="zx-page-head">
                <div className="zx-eyebrow" style={{ color: 'var(--zx-ok)' }}>{t('nav.tools')}</div>
                <h1 className="zx-sec-title">{t('tools.title')}</h1>
                <p className="zx-sec-sub">{t('tools.sub')}</p>
                {isAuthenticated && (
                    <p>
                        <Link to="/create-tool" className="uk-button uk-button-primary">
                            {t('tool.create_cta')}
                        </Link>
                    </p>
                )}
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
