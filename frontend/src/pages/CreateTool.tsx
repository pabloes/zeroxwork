import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import UIkit from 'uikit';
import { useTranslation } from '../i18n';
import { useAuth } from '../context/AuthContext';
import { apiErrorMessage } from '../services/api-error';
import ToolForm from '../components/editor/ToolForm';
import { createTool } from '../services/use-tools';

/**
 * /create-tool — dar de alta una herramienta.
 *
 * Nace borrador, como un artículo o un proyecto: nada llega al catálogo hasta
 * que quien la dio de alta le dé a publicar.
 */
const CreateTool: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [error, setError] = useState<string | null>(null);
    useAuth(); // asegura que hay sesión

    const mutation = useMutation({
        mutationFn: createTool,
        onSuccess: () => {
            setError(null);
            queryClient.invalidateQueries({ queryKey: ['my-tools'] });
            // Guardada, no publicada: decirlo, o quien la escribe se va pensando
            // que está viva y luego no entiende por qué /tools no la enseña.
            UIkit.notification(t('tool.created_draft'), { status: 'success', timeout: 7000 });
            navigate('/my-tools');
        },
        onError: (failure) => {
            const message = apiErrorMessage(failure, t, 'tool.error.create_failed');
            setError(message);
            UIkit.notification(message, { status: 'danger', timeout: 7000 });
        },
    });

    return (
        <div className="zx-wrap zx-page">
            <div className="zx-page-head">
                <div className="zx-eyebrow" style={{ color: 'var(--zx-ok)' }}>{t('nav.tools')}</div>
                <h1 className="zx-sec-title">{t('tool.create_title')}</h1>
                <p className="zx-sec-sub">{t('tool.create_sub')}</p>
            </div>

            <ToolForm
                submitting={mutation.status === 'pending'}
                error={error}
                onSubmit={(payload) => mutation.mutate(payload)}
            />
        </div>
    );
};

export default CreateTool;
