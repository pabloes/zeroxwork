import { Link } from 'react-router-dom';
import { useTranslation } from "../i18n";
import { toolTarget, isExternal, type Tool } from "../services/use-tools";

const ACCENTS = ['var(--zx-blue)', 'var(--zx-orange)', 'var(--zx-mint)', 'var(--zx-red)', 'var(--zx-cyan)'];

/**
 * Una herramienta en el catálogo.
 *
 * La tarjeta lleva al sitio, no a una parada intermedia: si la herramienta se
 * abre, ésta es la última pantalla nuestra que ve nadie. Sólo las que se
 * incrustan pasan por una página propia, porque el iframe tiene que ir dentro
 * de la nuestra.
 */
const ToolCard: React.FC<{ tool: Tool; index?: number }> = ({ tool, index = 0 }) => {
    const { t } = useTranslation();
    const tags = (tool.tags ?? []).map((tag) => tag.name).slice(0, 3).join(' · ');
    const destino = toolTarget(tool);
    const fuera = isExternal(destino);

    const dentro = (
        <>
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
            {/* La línea que explica qué es. Puede no haberla: dos de las tres
                primeras herramientas no tenían una sola palabra escrita. */}
            {tool.summary && <p className="zx-tool-desc">{tool.summary}</p>}
            <span className="zx-tool-tags">{tags}</span>
            <span className="zx-tool-go">{t('common.open')} →</span>
        </>
    );

    const estilo = { '--zx-accent': ACCENTS[index % ACCENTS.length] } as React.CSSProperties;

    // Una dirección de fuera no es una ruta del router: con <Link> acabaría
    // buscando "https:" dentro del propio sitio.
    return fuera ? (
        <a href={destino} className="zx-tool" style={estilo} target="_blank" rel="noopener noreferrer">
            {dentro}
        </a>
    ) : (
        <Link to={destino} className="zx-tool" style={estilo}>
            {dentro}
        </Link>
    );
};

export default ToolCard;
