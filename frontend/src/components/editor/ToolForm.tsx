import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../services/axios-setup';
import { useTranslation } from '../../i18n';
import { slugify } from '../../utils/slug';
import ArticleEditor from './ArticleEditor';
import ImagePicker from './ImagePicker';
import TagsField from './TagsField';
import {
    SUMMARY_MAX,
    EMBED_HEIGHT_MIN,
    EMBED_HEIGHT_MAX,
    EMBED_HEIGHT_DEFAULT,
    isAllowedHref,
    isEmbeddable,
} from '../../services/tool-fields';
import type { Tool, ToolMode, ToolPayload } from '../../services/use-tools';

const SUPPORTED_LANGS = [
    { code: 'es', name: 'Español' },
    { code: 'en', name: 'English' },
    { code: 'pt-br', name: 'Português (Brasil)' },
    { code: 'zh', name: '中文' },
    { code: 'fr', name: 'Français' },
];

interface Tag {
    id: number;
    name: string;
}

interface Props {
    /** La herramienta que se edita, o nada cuando se está dando de alta. */
    initial?: Tool;
    submitting: boolean;
    error: string | null;
    onSubmit: (payload: ToolPayload) => void;
}

/**
 * El formulario de una herramienta, para el alta y para la edición.
 *
 * No es el de artículo ni el de proyecto, y sobre todo es más corto: no hay
 * categoría que elegir —estar aquí es lo que la hace una herramienta—, ni
 * galería, ni créditos, ni fechas, ni estado. Lo que sí hay, y en ningún otro
 * sitio había: dónde vive la cosa, y si se abre o se incrusta.
 *
 * El cuerpo es opcional a propósito. Dos de las tres primeras herramientas no
 * tenían una sola palabra, y pedírsela sólo habría conseguido relleno.
 */
const ToolForm: React.FC<Props> = ({ initial, submitting, error, onSubmit }) => {
    const { t } = useTranslation();
    const creating = initial === undefined;

    const [title, setTitle] = useState(initial?.title ?? '');
    const [slug, setSlug] = useState(initial?.slug ?? '');
    const [autoSlug, setAutoSlug] = useState(creating);
    const [lang, setLang] = useState(initial?.lang ?? 'es');
    const [summary, setSummary] = useState(initial?.summary ?? '');
    const [content, setContent] = useState(initial?.content ?? '');
    const [thumbnail, setThumbnail] = useState(initial?.thumbnail ?? '');
    const [coverPickerOpen, setCoverPickerOpen] = useState(false);
    const [href, setHref] = useState(initial?.href ?? '');
    const [mode, setMode] = useState<ToolMode>(initial?.mode ?? 'link');
    const [embedHeight, setEmbedHeight] = useState(String(initial?.embedHeight ?? EMBED_HEIGHT_DEFAULT));
    const [selectedTagIds, setSelectedTagIds] = useState<number[]>(initial?.tags.map((tag) => tag.id) ?? []);
    const [newTags, setNewTags] = useState<string[]>([]);
    /** Lo que el propio formulario se niega a mandar, dicho donde están los campos. */
    const [localError, setLocalError] = useState<string | null>(null);

    const { data: tags = [] } = useQuery({
        queryKey: ['tags'],
        queryFn: async (): Promise<Tag[]> => (await api.get('/blog/tags')).data,
    });

    useEffect(() => {
        if (autoSlug) setSlug(slugify(title));
    }, [title, autoSlug]);

    const reject = (key: string) => {
        setLocalError(t(key));
        return false;
    };

    /** Todo lo que el servidor rechazaría, dicho aquí para no esperar al viaje. */
    const looksSendable = () => {
        if (title.trim() === '') return reject('tool.error.title_required');
        if (href.trim() === '') return reject('tool.error.href_required');
        if (!isAllowedHref(href)) return reject('tool.error.href_invalid');
        if (mode === 'embed' && !isEmbeddable(href)) return reject('tool.error.href_not_embeddable');
        if (summary.length > SUMMARY_MAX) return reject('tool.error.summary_long');

        if (mode === 'embed') {
            const height = Number(embedHeight);
            if (!Number.isInteger(height) || height < EMBED_HEIGHT_MIN || height > EMBED_HEIGHT_MAX) {
                return reject('tool.error.embed_height');
            }
        }

        setLocalError(null);
        return true;
    };

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (!looksSendable()) return;

        onSubmit({
            title: title.trim(),
            summary: summary.trim(),
            content,
            lang,
            slug: slug.trim() || undefined,
            thumbnail: thumbnail.trim(),
            href: href.trim(),
            mode,
            embedHeight: mode === 'embed' ? Number(embedHeight) : undefined,
            tagIds: selectedTagIds,
            newTags,
        });
    };

    const shown = localError ?? error;

    return (
        <form className="uk-form-stacked" onSubmit={handleSubmit}>
            <div className="uk-margin">
                <label className="uk-form-label" htmlFor="title">{t('tool.title_label')}</label>
                <div className="uk-form-controls">
                    <input
                        className="uk-input"
                        id="title"
                        type="text"
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        required
                        placeholder={t('tool.title_placeholder')}
                    />
                </div>
                <p className="uk-text-meta">{t('tool.title_not_translated')}</p>
            </div>

            <div className="uk-margin">
                <label className="uk-form-label" htmlFor="slug">{t('tool.url_label')}</label>
                <div className="uk-form-controls uk-grid-small uk-flex-middle" uk-grid="">
                    <div className="uk-width-expand">
                        <input
                            className="uk-input"
                            id="slug"
                            type="text"
                            value={slug}
                            onChange={(event) => {
                                setSlug(event.target.value);
                                setAutoSlug(false);
                            }}
                            placeholder="tool-url-handle"
                        />
                    </div>
                    <div>
                        <label>
                            <input
                                className="uk-checkbox"
                                type="checkbox"
                                checked={autoSlug}
                                onChange={(event) => setAutoSlug(event.target.checked)}
                            />
                            {' '}{t('tool.url_auto')}
                        </label>
                    </div>
                </div>
            </div>

            {/* El destino y el modo, juntos, porque uno decide lo que vale el
                otro: una ruta de este sitio se puede abrir pero no incrustar. */}
            <div className="uk-margin">
                <label className="uk-form-label">{t('tool.mode_label')}</label>
                <div className="uk-form-controls">
                    <label className="uk-margin-right">
                        <input
                            className="uk-radio"
                            type="radio"
                            name="mode"
                            value="link"
                            checked={mode === 'link'}
                            onChange={() => setMode('link')}
                        />
                        {' '}{t('tool.mode_link')}
                    </label>
                    <label>
                        <input
                            className="uk-radio"
                            type="radio"
                            name="mode"
                            value="embed"
                            checked={mode === 'embed'}
                            onChange={() => setMode('embed')}
                        />
                        {' '}{t('tool.mode_embed')}
                    </label>
                </div>
                <p className="uk-text-meta">
                    {mode === 'embed' ? t('tool.mode_embed_hint') : t('tool.mode_link_hint')}
                </p>
            </div>

            <div className="uk-margin">
                <label className="uk-form-label" htmlFor="href">{t('tool.href_label')}</label>
                <div className="uk-form-controls">
                    <input
                        className="uk-input"
                        id="href"
                        type="text"
                        value={href}
                        onChange={(event) => setHref(event.target.value)}
                        required
                        placeholder={mode === 'embed' ? 'https://...' : '/speed-test'}
                        aria-invalid={href !== '' && !isAllowedHref(href)}
                    />
                </div>
                <p className="uk-text-meta">
                    {href !== '' && !isAllowedHref(href)
                        ? t('tool.error.href_invalid')
                        : (mode === 'embed' && href !== '' && !isEmbeddable(href)
                            ? t('tool.error.href_not_embeddable')
                            : t('tool.href_hint'))}
                </p>
            </div>

            {mode === 'embed' && (
                <div className="uk-margin">
                    <label className="uk-form-label" htmlFor="embedHeight">{t('tool.embed_height_label')}</label>
                    <div className="uk-form-controls">
                        <input
                            className="uk-input uk-form-width-small"
                            id="embedHeight"
                            type="number"
                            min={EMBED_HEIGHT_MIN}
                            max={EMBED_HEIGHT_MAX}
                            step={50}
                            value={embedHeight}
                            onChange={(event) => setEmbedHeight(event.target.value)}
                        />
                    </div>
                    <p className="uk-text-meta">{t('tool.embed_height_hint')}</p>
                </div>
            )}

            <div className="uk-margin">
                <label className="uk-form-label" htmlFor="summary">{t('tool.summary_label')}</label>
                <div className="uk-form-controls">
                    <textarea
                        className="uk-textarea"
                        id="summary"
                        rows={2}
                        value={summary}
                        onChange={(event) => setSummary(event.target.value)}
                        maxLength={SUMMARY_MAX}
                        placeholder={t('tool.summary_placeholder')}
                    />
                </div>
                <p className="uk-text-meta">{`${summary.length} / ${SUMMARY_MAX}`}</p>
            </div>

            <div className="uk-margin">
                <label className="uk-form-label" htmlFor="lang">{t('tool.lang_label')}</label>
                <div className="uk-form-controls">
                    <select
                        className="uk-select"
                        id="lang"
                        value={lang}
                        onChange={(event) => setLang(event.target.value)}
                    >
                        {SUPPORTED_LANGS.map((option) => (
                            <option key={option.code} value={option.code}>{option.name}</option>
                        ))}
                    </select>
                </div>
                <p className="uk-text-meta">{t('tool.lang_hint')}</p>
            </div>

            <div className="uk-margin">
                <label className="uk-form-label" htmlFor="thumbnail">{t('tool.cover_label')}</label>
                <div className="uk-form-controls zx-thumb-field">
                    <input
                        className="uk-input"
                        id="thumbnail"
                        type="text"
                        value={thumbnail}
                        onChange={(event) => setThumbnail(event.target.value)}
                        placeholder="/api/images/..."
                    />
                    <button type="button" className="zx-tb-text" onClick={() => setCoverPickerOpen(true)}>
                        {t('editor.image_from_library')}
                    </button>
                </div>
                {coverPickerOpen && (
                    <ImagePicker
                        onClose={() => setCoverPickerOpen(false)}
                        onSelect={(url) => {
                            setThumbnail(url);
                            setCoverPickerOpen(false);
                        }}
                    />
                )}
                {thumbnail !== '' && (
                    <div className="uk-margin-small-top">
                        <img
                            src={thumbnail}
                            alt=""
                            style={{ maxWidth: '240px', maxHeight: '160px', objectFit: 'cover' }}
                        />
                    </div>
                )}
            </div>

            <TagsField
                all={tags}
                label={t('tool.tags_label')}
                value={{ tagIds: selectedTagIds, newTags }}
                onChange={(next) => { setSelectedTagIds(next.tagIds); setNewTags(next.newTags); }}
            />

            <div className="uk-margin">
                <label className="uk-form-label" htmlFor="content">{t('tool.content_label')}</label>
                <div className="uk-form-controls">
                    <ArticleEditor value={content} onChange={setContent} />
                </div>
                <p className="uk-text-meta">
                    {mode === 'embed' ? t('tool.content_hint_embed') : t('tool.content_hint_link')}
                </p>
            </div>

            <div className="uk-margin">
                {shown && <p className="zx-form-error">{shown}</p>}
                <button className="uk-button uk-button-primary" type="submit" disabled={submitting}>
                    {submitting ? t('tool.saving') : t(creating ? 'tool.create_submit' : 'tool.save_submit')}
                </button>
                {initial && (
                    <Link className="uk-button uk-button-default uk-margin-small-left" to="/my-tools">
                        {t('nav.my_tools')}
                    </Link>
                )}
            </div>
        </form>
    );
};

export default ToolForm;
