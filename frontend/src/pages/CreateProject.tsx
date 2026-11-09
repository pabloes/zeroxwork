import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import UIkit from 'uikit';
import { useTranslation } from '../i18n';
import { useAuth } from '../context/AuthContext';
import { apiErrorMessage } from '../services/api-error';
import ProjectForm from '../components/editor/ProjectForm';
import { createProject } from '../services/use-projects';

/**
 * /create-project — entering a portfolio item.
 *
 * Any member may. It is saved as a draft, so nothing reaches the portfolio
 * until whoever entered it presses publish: the same rule as an article.
 */
const CreateProject: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [error, setError] = useState<string | null>(null);
    useAuth(); // ensure authenticated

    const mutation = useMutation({
        mutationFn: createProject,
        onSuccess: (project) => {
            setError(null);
            queryClient.invalidateQueries({ queryKey: ['my-projects'] });
            // Saved, not published: say so, or the author walks away thinking it
            // is live and wonders why the portfolio does not show it.
            UIkit.notification(t('project.created_draft'), { status: 'success', timeout: 7000 });
            navigate(`/portfolio/${project.slug}`);
        },
        onError: (failure) => {
            const message = apiErrorMessage(failure, t, 'project.error.create_failed');
            setError(message);
            UIkit.notification(message, { status: 'danger', timeout: 7000 });
        },
    });

    return (
        <div className="zx-wrap zx-page">
            <div className="zx-page-head">
                <div className="zx-eyebrow" style={{ color: 'var(--zx-orange)' }}>{t('nav.portfolio')}</div>
                <h1 className="zx-sec-title">{t('project.create_title')}</h1>
                <p className="zx-sec-sub">{t('project.create_sub')}</p>
            </div>

            <ProjectForm
                submitting={mutation.status === 'pending'}
                error={error}
                onSubmit={(payload) => mutation.mutate(payload)}
            />
        </div>
    );
};

export default CreateProject;
