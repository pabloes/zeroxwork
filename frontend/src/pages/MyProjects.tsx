import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import UIkit from 'uikit';
import { useTranslation } from '../i18n';
import { apiErrorMessage } from '../services/api-error';
import ConfirmActionModal from '../components/ConfirmActionModal';
import {
    useMyProjects,
    setProjectPublished,
    deleteProject,
    type MyProject,
} from '../services/use-projects';

/**
 * /my-projects — the portfolio items this member entered, drafts included.
 *
 * The only place a draft project is visible as such, so the state is on the
 * card and publishing happens from here, exactly like /my-articles.
 */
const MyProjects: React.FC = () => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { data: projects = [], isLoading, isError } = useMyProjects();
    const [toDelete, setToDelete] = useState<MyProject | null>(null);

    const refresh = () => {
        queryClient.invalidateQueries({ queryKey: ['my-projects'] });
        queryClient.invalidateQueries({ queryKey: ['projects'] });
        queryClient.invalidateQueries({ queryKey: ['project'] });
    };

    // The error matters here: a project with nobody on it is refused, and the
    // author needs to read why rather than watch the button do nothing.
    const publishMutation = useMutation({
        mutationFn: setProjectPublished,
        onSuccess: (_data, variables) => {
            UIkit.notification(
                t(variables.published ? 'project.published_ok' : 'project.unpublished_ok'),
                { status: 'success' },
            );
            refresh();
        },
        onError: (error) => {
            UIkit.notification(apiErrorMessage(error, t, 'project.publish_failed'), {
                status: 'danger',
                timeout: 7000,
            });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: deleteProject,
        onSuccess: () => {
            UIkit.notification(t('project.deleted_ok'), { status: 'success' });
            refresh();
        },
        onError: (error) => {
            UIkit.notification(apiErrorMessage(error, t, 'project.delete_failed'), {
                status: 'danger',
                timeout: 7000,
            });
        },
    });

    return (
        <div className="zx-wrap zx-page">
            <div className="zx-page-head">
                <div className="zx-eyebrow" style={{ color: 'var(--zx-orange)' }}>{t('nav.portfolio')}</div>
                <h1 className="zx-sec-title">{t('nav.my_projects')}</h1>
                <p className="zx-sec-sub">{t('project.mine_sub')}</p>
                <p>
                    <Link to="/create-project" className="uk-button uk-button-primary">
                        {t('project.create_cta')}
                    </Link>
                </p>
            </div>

            {projects.length > 0 ? (
                <div className="uk-grid-small uk-child-width-1-2@s uk-child-width-1-3@m" data-uk-grid>
                    {projects.map((project) => (
                        <div key={project.id}>
                            <div className="uk-card uk-card-hover">
                                <Link to={`/portfolio/${project.slug}`} className="uk-link-reset">
                                    <div className="uk-cover-container">
                                        {project.thumbnail ? (
                                            <img src={project.thumbnail} alt={project.title} data-uk-cover />
                                        ) : (
                                            <div className="uk-placeholder">{t('project.no_cover')}</div>
                                        )}
                                        <canvas width="600" height="400"></canvas>

                                        <span className={`zx-state ${project.published ? 'is-live' : 'is-draft'}`}>
                                            {t(project.published ? 'article.state_published' : 'article.state_draft')}
                                        </span>

                                        <div className="uk-overlay uk-overlay-primary uk-position-bottom uk-light">
                                            <h3 className="uk-card-title">{project.title}</h3>
                                            <p className="uk-text-meta">
                                                {`${project.members} ${t('project.members_count')}`}
                                            </p>
                                        </div>
                                    </div>
                                </Link>
                            </div>
                            <div className="uk-margin-small-top">
                                <button
                                    className={`uk-button uk-width-1-1 uk-margin-small-bottom ${project.published ? 'uk-button-default' : 'uk-button-primary'}`}
                                    onClick={() => publishMutation.mutate({ id: project.id, published: !project.published })}
                                    disabled={publishMutation.isPending}
                                >
                                    {t(project.published ? 'article.unpublish' : 'article.publish')}
                                </button>
                                <Link
                                    to={`/edit-project/${project.id}`}
                                    className="uk-button uk-button-secondary uk-width-1-1 uk-margin-small-bottom"
                                >
                                    {t('project.edit_cta')}
                                </Link>
                                <button
                                    className="uk-button uk-button-danger uk-width-1-1"
                                    onClick={() => setToDelete(project)}
                                >
                                    {t('project.delete_cta')}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="zx-empty">
                    {isLoading ? t('common.loading') : isError ? t('article.error.network') : t('project.mine_empty')}
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
                    title={t('project.delete_title')}
                    message={`${t('project.delete_warning')} "${toDelete.title}"`}
                    confirmButtonText={t('project.delete_cta')}
                    cancelButtonText={t('project.delete_cancel')}
                    wordToType="delete"
                    imageSrc={toDelete.thumbnail ?? ''}
                />
            )}
        </div>
    );
};

export default MyProjects;
