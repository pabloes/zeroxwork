import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import UIkit from 'uikit';
import { useTranslation } from '../i18n';
import { useAuth } from '../context/AuthContext';
import { apiErrorMessage } from '../services/api-error';
import ToolForm from '../components/editor/ToolForm';
import { updateTool, useToolForEdit } from '../services/use-tools';

/**
 * /edit-tool/:id — editar una herramienta.
 *
 * Se carga sin idioma, para que el formulario enseñe siempre el texto original:
 * guardar una copia traducida encima del original sobrescribiría el texto del
 * que salió.
 */
const EditTool: React.FC = () => {
    const { t } = useTranslation();
    const { id = '' } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [error, setError] = useState<string | null>(null);
    useAuth(); // asegura que hay sesión

    const { data: tool, isLoading, isError } = useToolForEdit(id);

    const mutation = useMutation({
        mutationFn: updateTool,
        onSuccess: () => {
            setError(null);
            queryClient.invalidateQueries({ queryKey: ['my-tools'] });
            queryClient.invalidateQueries({ queryKey: ['tools'] });
            queryClient.invalidateQueries({ queryKey: ['tool'] });
            queryClient.invalidateQueries({ queryKey: ['tool-edit', id] });
            UIkit.notification(t('tool.saved'), { status: 'success', timeout: 5000 });
            navigate('/my-tools');
        },
        onError: (failure) => {
            const message = apiErrorMessage(failure, t, 'tool.error.update_failed');
            setError(message);
            UIkit.notification(message, { status: 'danger', timeout: 7000 });
        },
    });

    if (isLoading) {
        return <div className="zx-wrap zx-page"><div className="zx-empty">{t('common.loading')}</div></div>;
    }

    // Un borrador responde 404 a quien no puede editarlo, así que no hay más
    // que decir que eso: que no está.
    if (isError || !tool) {
        return (
            <div className="zx-wrap zx-page">
                <div className="zx-page-head">
                    <h1 className="zx-sec-title">{t('tool.not_found_title')}</h1>
                    <p className="zx-sec-sub">{t('tool.not_found')}</p>
                    <p><Link to="/my-tools">{t('nav.my_tools')}</Link></p>
                </div>
            </div>
        );
    }

    // Una herramienta publicada la carga cualquiera, y el servidor dice
    // `canEdit: false` cuando va a rechazar el guardado. Abrir el formulario
    // igualmente es rellenarlo entero para enterarse en el botón de Guardar.
    if (tool.canEdit === false) {
        return (
            <div className="zx-wrap zx-page">
                <div className="zx-page-head">
                    <h1 className="zx-sec-title">{t('tool.cannot_edit_title')}</h1>
                    <p className="zx-sec-sub">{t('tool.cannot_edit')}</p>
                    <p><Link to="/tools">{t('tool.back_to_tools')}</Link></p>
                </div>
            </div>
        );
    }

    return (
        <div className="zx-wrap zx-page">
            <div className="zx-page-head">
                <div className="zx-eyebrow" style={{ color: 'var(--zx-ok)' }}>
                    <Link to="/my-tools">{t('nav.my_tools')}</Link>
                </div>
                <h1 className="zx-sec-title">{t('tool.edit_title')}</h1>
                <p className="zx-sec-sub">
                    {tool.published ? t('tool.edit_live_sub') : t('tool.edit_draft_sub')}
                </p>
            </div>

            <ToolForm
                initial={tool}
                submitting={mutation.status === 'pending'}
                error={error}
                onSubmit={(payload) => mutation.mutate({ ...payload, id: tool.id })}
            />
        </div>
    );
};

export default EditTool;
