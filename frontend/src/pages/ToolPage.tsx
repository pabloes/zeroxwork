import ReactMarkdown from 'react-markdown';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from '../i18n';
import { useTool, isExternal } from '../services/use-tools';
import { getIframeSandbox } from '../utils/iframe-sandbox';
import PageTitle from '../components/PageTitle';

/**
 * /tools/:idOrSlug — una herramienta.
 *
 * Esta página existe sobre todo para las que se incrustan: el iframe va dentro
 * de nuestra página y necesita una página donde ir. Las que saltan se abren
 * desde la tarjeta sin pasar por aquí, pero responden igual, porque una
 * dirección que alguien puede pegar en el navegador tiene que llevar a algo.
 *
 * El `sandbox` no se decide aquí: lo da `getIframeSandbox`, que reparte
 * permisos según el origen. Una dapp necesita `allow-same-origin` para hablar
 * con la cartera, y eso sólo se le concede a lo que ya estaba en la lista.
 */
const ToolPage: React.FC = () => {
    const { t } = useTranslation();
    const { idOrSlug = '' } = useParams();
    const { data: tool, isLoading, isError } = useTool(idOrSlug);

    if (isLoading) {
        return <div className="zx-wrap zx-page"><div className="zx-empty">{t('common.loading')}</div></div>;
    }

    if (isError || !tool) {
        return (
            <div className="zx-wrap zx-page">
                <div className="zx-page-head">
                    <h1 className="zx-sec-title">{t('tool.not_found_title')}</h1>
                    <p className="zx-sec-sub">{t('tool.not_found')}</p>
                    <p><Link to="/tools">{t('tool.back_to_tools')}</Link></p>
                </div>
            </div>
        );
    }

    const fuera = isExternal(tool.href);

    return (
        <div className="zx-wrap zx-page">
            {!tool.published && (
                <p className="zx-draft-notice">{t('tool.draft_notice')}</p>
            )}

            {tool.canEdit && (
                <p>
                    <Link to={`/edit-tool/${tool.id}`} className="uk-button uk-button-default uk-button-small">
                        {t('tool.edit_cta')}
                    </Link>
                </p>
            )}

            <div className="zx-page-head">
                <div className="zx-eyebrow" style={{ color: 'var(--zx-ok)' }}>
                    <Link to="/tools">{t('nav.tools')}</Link>
                </div>
                <PageTitle title={tool.title} className="zx-proj-h1" />
                {tool.summary && <p className="zx-proj-lead">{tool.summary}</p>}
            </div>

            {tool.mode === 'embed' ? (
                <div className="zx-tool-embed">
                    <iframe
                        src={tool.href}
                        title={tool.title}
                        height={tool.embedHeight ?? 600}
                        sandbox={getIframeSandbox(tool.href)}
                        loading="lazy"
                        allow="clipboard-write"
                    />
                </div>
            ) : (
                <p className="uk-margin">
                    <a
                        className="uk-button uk-button-primary"
                        href={tool.href}
                        // Lo de fuera, en otra pestaña; lo de casa, en esta.
                        target={fuera ? '_blank' : undefined}
                        rel={fuera ? 'noopener noreferrer' : undefined}
                    >
                        {t('common.open')} →
                    </a>
                </p>
            )}

            {tool.content && (
                <section className="zx-proj-body markdown-body">
                    <ReactMarkdown>{tool.content}</ReactMarkdown>
                </section>
            )}

            {tool.tags.length > 0 && (
                <div className="zx-pcard-chips uk-margin">
                    {tool.tags.map((tag) => (
                        <span className="zx-chip" key={tag.id}>{tag.name}</span>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ToolPage;
