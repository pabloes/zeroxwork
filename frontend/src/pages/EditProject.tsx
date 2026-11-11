import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import UIkit from 'uikit';
import { useTranslation } from '../i18n';
import { useAuth } from '../context/AuthContext';
import { apiErrorMessage } from '../services/api-error';
import ProjectForm from '../components/editor/ProjectForm';
import { updateProject, useProjectForEdit } from '../services/use-projects';

/**
 * /edit-project/:id — editing a portfolio item.
 *
 * Loaded without a language, so the form always shows the original text: a
 * translated copy saved back over the source would overwrite the very text it
 * was translated from.
 */
const EditProject: React.FC = () => {
    const { t } = useTranslation();
    const { id = '' } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [error, setError] = useState<string | null>(null);
    useAuth(); // ensure authenticated

    const { data: project, isLoading, isError } = useProjectForEdit(id);

    const mutation = useMutation({
        mutationFn: updateProject,
        onSuccess: (saved) => {
            setError(null);
            queryClient.invalidateQueries({ queryKey: ['my-projects'] });
            queryClient.invalidateQueries({ queryKey: ['projects'] });
            queryClient.invalidateQueries({ queryKey: ['project'] });
            queryClient.invalidateQueries({ queryKey: ['project-edit', id] });
            UIkit.notification(t('project.saved'), { status: 'success', timeout: 5000 });
            navigate(`/portfolio/${saved.slug}`);
        },
        onError: (failure) => {
            const message = apiErrorMessage(failure, t, 'project.error.update_failed');
            setError(message);
            UIkit.notification(message, { status: 'danger', timeout: 7000 });
        },
    });

    if (isLoading) {
        return <div className="zx-wrap zx-page"><div className="zx-empty">{t('common.loading')}</div></div>;
    }

    // A draft answers 404 to anyone who may not edit it, so there is nothing
    // more to say than that it is not there.
    if (isError || !project) {
        return (
            <div className="zx-wrap zx-page">
                <div className="zx-page-head">
                    <h1 className="zx-sec-title">{t('project.not_found_title')}</h1>
                    <p className="zx-sec-sub">{t('project.not_found')}</p>
                    <p><Link to="/my-projects">{t('nav.my_projects')}</Link></p>
                </div>
            </div>
        );
    }

    // A published project loads for anybody, and the server says `canEdit:
    // false` when it will refuse the save. Opening the form regardless means
    // filling it in, uploading images, arranging a gallery -- and finding out
    // at the Save button. Say it here, where it still costs nothing.
    // `=== false` on purpose: a response without the field is not a refusal,
    // and the server has the last word either way.
    if (project.canEdit === false) {
        return (
            <div className="zx-wrap zx-page">
                <div className="zx-page-head">
                    <h1 className="zx-sec-title">{t('project.cannot_edit_title')}</h1>
                    <p className="zx-sec-sub">{t('project.cannot_edit')}</p>
                    <p>
                        <Link to="/portfolio">{t('project.back_to_portfolio')}</Link>
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="zx-wrap zx-page">
            <div className="zx-page-head">
                <div className="zx-eyebrow" style={{ color: 'var(--zx-orange)' }}>
                    <Link to="/my-projects">{t('nav.my_projects')}</Link>
                </div>
                <h1 className="zx-sec-title">{t('project.edit_title')}</h1>
                <p className="zx-sec-sub">
                    {project.published ? t('project.edit_live_sub') : t('project.edit_draft_sub')}
                </p>
            </div>

            <ProjectForm
                initial={project}
                submitting={mutation.status === 'pending'}
                error={error}
                onSubmit={(payload) => mutation.mutate({ ...payload, id: project.id })}
            />
        </div>
    );
};

export default EditProject;
