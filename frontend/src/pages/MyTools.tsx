import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import UIkit from 'uikit';
import { useTranslation } from '../i18n';
import { apiErrorMessage } from '../services/api-error';
import ConfirmActionModal from '../components/ConfirmActionModal';
import {
    useMyTools,
    setToolPublished,
    deleteTool,
    type MyTool,
} from '../services/use-tools';

/**
 * /my-tools — las herramientas que ha dado de alta este miembro, borradores
 * incluidos. El único sitio donde un borrador se ve como tal, así que el estado
 * va en la tarjeta y se publica desde aquí, igual que en /my-projects.
 */
const MyTools: React.FC = () => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { data: tools = [], isLoading, isError } = useMyTools();
    const [toDelete, setToDelete] = useState<MyTool | null>(null);

    const refresh = () => {
        queryClient.invalidateQueries({ queryKey: ['my-tools'] });
        queryClient.invalidateQueries({ queryKey: ['tools'] });
        queryClient.invalidateQueries({ queryKey: ['tool'] });
    };

    const publishMutation = useMutation({
        mutationFn: setToolPublished,
        onSuccess: (_data, variables) => {
            UIkit.notification(
                t(variables.published ? 'tool.published_ok' : 'tool.unpublished_ok'),
                { status: 'success' },
            );
            refresh();
        },
        onError: (error) => {
            UIkit.notification(apiErrorMessage(error, t, 'tool.publish_failed'), {
                status: 'danger',
                timeout: 7000,
            });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: deleteTool,
        onSuccess: () => {
            UIkit.notification(t('tool.deleted_ok'), { status: 'success' });
            refresh();
        },
        onError: (error) => {
            UIkit.notification(apiErrorMessage(error, t, 'tool.delete_failed'), {
                status: 'danger',
                timeout: 7000,
            });
        },
    });

    return (
        <div className="zx-wrap zx-page">
            <div className="zx-page-head">
                <div className="zx-eyebrow" style={{ color: 'var(--zx-ok)' }}>{t('nav.tools')}</div>
                <h1 className="zx-sec-title">{t('nav.my_tools')}</h1>
                <p className="zx-sec-sub">{t('tool.mine_sub')}</p>
                <p>
                    <Link to="/create-tool" className="uk-button uk-button-primary">
                        {t('tool.create_cta')}
                    </Link>
                </p>
            </div>

            {tools.length > 0 ? (
                <div className="uk-grid-small uk-child-width-1-2@s uk-child-width-1-3@m" data-uk-grid>
                    {tools.map((tool) => (
                        <div key={tool.id}>
                            {/* Con imagen, el título va encima de ella; sin imagen, la
                                tarjeta es sólo texto. La mayoría de herramientas no
                                tendrán imagen -- son una ficha, no una galería -- así que
                                el hueco con el título colgando debajo sería el caso
                                normal, no la excepción. */}
                            <div className="uk-card uk-card-hover zx-mytool">
                                {tool.thumbnail ? (
                                    <div className="uk-cover-container">
                                        <img src={tool.thumbnail} alt={tool.title} data-uk-cover />
                                        <canvas width="600" height="400"></canvas>

                                        <span className={`zx-state ${tool.published ? 'is-live' : 'is-draft'}`}>
                                            {t(tool.published ? 'article.state_published' : 'article.state_draft')}
                                        </span>

                                        <div className="uk-overlay uk-overlay-primary uk-position-bottom uk-light">
                                            <h3 className="uk-card-title">{tool.title}</h3>
                                            {/* El destino, que es lo que de verdad distingue una
                                                ficha de otra, y lo que más se equivoca uno al teclear. */}
                                            <p className="uk-text-meta">
                                                {`${t(tool.mode === 'embed' ? 'tool.mode_embed' : 'tool.mode_link')} · ${tool.href}`}
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="zx-mytool-plain">
                                        <span className={`zx-state ${tool.published ? 'is-live' : 'is-draft'}`}>
                                            {t(tool.published ? 'article.state_published' : 'article.state_draft')}
                                        </span>
                                        <h3 className="uk-card-title">{tool.title}</h3>
                                        <p className="uk-text-meta zx-mytool-href">
                                            {`${t(tool.mode === 'embed' ? 'tool.mode_embed' : 'tool.mode_link')} · ${tool.href}`}
                                        </p>
                                    </div>
                                )}
                            </div>
                            <div className="uk-margin-small-top">
                                <button
                                    className={`uk-button uk-width-1-1 uk-margin-small-bottom ${tool.published ? 'uk-button-default' : 'uk-button-primary'}`}
                                    onClick={() => publishMutation.mutate({ id: tool.id, published: !tool.published })}
                                    disabled={publishMutation.isPending}
                                >
                                    {t(tool.published ? 'article.unpublish' : 'article.publish')}
                                </button>
                                <Link
                                    to={`/edit-tool/${tool.id}`}
                                    className="uk-button uk-button-secondary uk-width-1-1 uk-margin-small-bottom"
                                >
                                    {t('tool.edit_cta')}
                                </Link>
                                <button
                                    className="uk-button uk-button-danger uk-width-1-1"
                                    onClick={() => setToDelete(tool)}
                                >
                                    {t('tool.delete_cta')}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="zx-empty">
                    {isLoading ? t('common.loading') : isError ? t('article.error.network') : t('tool.mine_empty')}
                </div>
            )}

            {toDelete && (
                <ConfirmActionModal
                    show={toDelete !== null}
                    onClose={() => setToDelete(null)}
                    onConfirm={() => {
                        deleteMutation.mutate(toDelete.id);
                        setToDelete(null);
                    }}
                    title={t('tool.delete_title')}
                    message={`${t('tool.delete_warning')} "${toDelete.title}"`}
                    confirmButtonText={t('tool.delete_cta')}
                    cancelButtonText={t('tool.delete_cancel')}
                    wordToType="delete"
                    imageSrc={toDelete.thumbnail ?? ''}
                />
            )}
        </div>
    );
};

export default MyTools;
