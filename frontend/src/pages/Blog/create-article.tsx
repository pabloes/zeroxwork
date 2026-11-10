import React, { useState, useEffect } from 'react';
import ArticleEditor from '../../components/editor/ArticleEditor';
import ImagePicker from '../../components/editor/ImagePicker';
import TagsField from '../../components/editor/TagsField';
import { useTranslation } from '../../i18n';
import { Link, useNavigate } from 'react-router-dom';
import UIkit from 'uikit';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../../services/axios-setup';
import { useAuth } from '../../context/AuthContext';
import { slugify } from '../../utils/slug';
import { apiErrorMessage } from '../../services/api-error';
import { isProjectCategory } from '../../services/project-media';

const SUPPORTED_LANGS = [
    { code: 'es', name: 'Español' },
    { code: 'en', name: 'English' },
    { code: 'pt-br', name: 'Português (Brasil)' },
    { code: 'zh', name: '中文' },
    { code: 'fr', name: 'Français' },
];

interface Category {
    id: number;
    name: string;
}

interface Tag {
    id: number;
    name: string;
}

// Service function for creating a new article
const createArticle = async (newArticle: {
    title: string;
    content: string;
    thumbnail: string;
    slug?: string;
    lang?: string;
    embedUrl?: string;
    embedHeight?: number;
    categoryId?: number | null;
    tagIds?: number[];
    newTags?: string[];
    type?: string;
    redirectUrl?: string;
}) => {
    const response = await api.post('/blog/articles', newArticle);
    return response.data;
};

const fetchCategories = async (): Promise<Category[]> => {
    const response = await api.get('/blog/categories');
    return response.data;
};

const fetchTags = async (): Promise<Tag[]> => {
    const response = await api.get('/blog/tags');
    return response.data;
};

const CreateArticle: React.FC = () => {
    const { t } = useTranslation();
    const [title, setTitle] = useState<string>('');
    const [content, setContent] = useState<string>('');
    const [embedUrl, setEmbedUrl] = useState<string>('');
    const [embedHeight, setEmbedHeight] = useState<number>(600);
    const [thumbnail, setThumbnail] = useState<string>('');
    const [slug, setSlug] = useState<string>('');
    const [lang, setLang] = useState<string>(() => localStorage.getItem('blogLang') || 'en');
    const [autoSlug, setAutoSlug] = useState<boolean>(true);
    const [categoryId, setCategoryId] = useState<number | null>(null);
    const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
    const [thumbPickerOpen, setThumbPickerOpen] = useState<boolean>(false);
    const [newTags, setNewTags] = useState<string[]>([]);
    const [articleType, setArticleType] = useState<'post' | 'link'>('post');
    const [redirectUrl, setRedirectUrl] = useState<string>('');
    // Why the last attempt did not go through, kept next to the submit button so
    // it is still on screen after the notification fades.
    const [formError, setFormError] = useState<string | null>(null);
    const navigate = useNavigate();
    useAuth(); // ensure authenticated

    // Auto-generate slug from title when autoSlug is enabled
    useEffect(() => {
        if (autoSlug) {
            setSlug(slugify(title));
        }
    }, [title, autoSlug]);

    // Handle manual slug change
    const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSlug(e.target.value);
        if (autoSlug) {
            setAutoSlug(false);
        }
    };

    // Fetch categories and tags
    const { data: categories = [] } = useQuery({
        queryKey: ['categories'],
        queryFn: fetchCategories,
    });

    const { data: tags = [] } = useQuery({
        queryKey: ['tags'],
        queryFn: fetchTags,
    });

    const mutation = useMutation({
        mutationFn: createArticle,
        onSuccess: (data) => {
            setFormError(null);
            // Saved, not published: say so, or the author walks away thinking it
            // is live and wonders why nobody can see it.
            UIkit.notification(t('article.created_draft'), { status: 'success', timeout: 7000 });
            navigate(`/view-article/${data.id}`);
        },
        onError: (error) => {
            const message = apiErrorMessage(error, t, 'article.error.create_failed');
            setFormError(message);
            UIkit.notification(message, { status: 'danger', timeout: 7000 });
        },
    });

    const { status } = mutation;

    const handleContentChange = (value: string) => {
        setContent(value);
    };

    // Everything but the portfolio. A project is not an article any more: it
    // has its own table, its own page and its own form, and leaving the
    // category here would only let someone write one that nothing ever shows.
    const pickable = categories.filter((cat) => !isProjectCategory(cat.name));

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // The editor starts empty and the API rejects a body-less post, so say so
        // here rather than send a request that cannot succeed. Pressing Enter in
        // the title field submits the form, which is how this happens by accident.
        if (articleType === 'post' && content.trim() === '') {
            setFormError(t('article.error.no_content'));
            UIkit.notification(t('article.error.no_content'), { status: 'warning', timeout: 7000 });
            return;
        }

        setFormError(null);
        mutation.mutate({
            title,
            content: articleType === 'post' ? content : '',
            thumbnail,
            slug: slug || undefined,
            lang,
            embedUrl: embedUrl || undefined,
            embedHeight: embedHeight || 600,
            categoryId: categoryId || null,
            tagIds: selectedTagIds,
            newTags: newTags,
            type: articleType,
            redirectUrl: articleType === 'link' ? redirectUrl : undefined,
        });
    };

// Check the status for loading state
    const isLoading = status === 'pending';

    return (
        <div className="uk-container uk-margin-large-top">
            <form className="uk-form-stacked" onSubmit={handleSubmit}>
                <div className="uk-margin">
                    <label className="uk-form-label" htmlFor="title">{t('article.form.title_label')}</label>
                    <div className="uk-form-controls">
                        <input
                            className="uk-input"
                            id="title"
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            required
                            placeholder={t('article.form.title_placeholder')}
                        />
                    </div>
                </div>

                <div className="uk-margin">
                    <label className="uk-form-label" htmlFor="slug">{t('article.form.slug_label')}</label>
                    <div className="uk-form-controls uk-grid-small uk-flex-middle" uk-grid="">
                        <div className="uk-width-expand">
                            <input
                                className="uk-input"
                                id="slug"
                                type="text"
                                value={slug}
                                onChange={handleSlugChange}
                                placeholder={t('article.form.slug_placeholder')}
                            />
                        </div>
                        <div>
                            <label>
                                <input
                                    className="uk-checkbox"
                                    type="checkbox"
                                    checked={autoSlug}
                                    onChange={(e) => setAutoSlug(e.target.checked)}
                                /> {t('article.form.slug_auto')}
                            </label>
                        </div>
                    </div>
                </div>

                <div className="uk-margin">
                    <label className="uk-form-label" htmlFor="lang">{t('article.form.lang_label')}</label>
                    <div className="uk-form-controls">
                        <select
                            className="uk-select"
                            id="lang"
                            value={lang}
                            onChange={(e) => setLang(e.target.value)}
                        >
                            {SUPPORTED_LANGS.map((l) => (
                                <option key={l.code} value={l.code}>{l.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="uk-margin">
                    <label className="uk-form-label" htmlFor="thumbnail">
                        {t('article.form.thumbnail_label')}
                    </label>
                    <div className="uk-form-controls zx-thumb-field">
                        <input
                            className="uk-input"
                            id="thumbnail"
                            type="text"
                            value={thumbnail}
                            onChange={(e) => setThumbnail(e.target.value)} // Update thumbnail state
                            placeholder={t('article.form.thumbnail_placeholder')}
                        />
                        <button type="button" className="zx-tb-text" onClick={() => setThumbPickerOpen(true)}>
                            {t('editor.image_from_library')}
                        </button>
                    </div>
                    {thumbPickerOpen && (
                        <ImagePicker
                            onClose={() => setThumbPickerOpen(false)}
                            onSelect={(url) => {
                                setThumbnail(url);
                                setThumbPickerOpen(false);
                            }}
                        />
                    )}

                    {/* Display thumbnail preview if valid URL is present */}
                    {thumbnail && (
                        <div className="uk-margin">
                            <img
                                src={thumbnail}
                                alt={t('article.form.thumbnail_alt')}
                                style={{ maxWidth: '200px', maxHeight: '200px', objectFit: 'cover' }}
/*
                                onError={handleThumbnailError} // Clear thumbnail if URL is invalid
*/
                            />
                        </div>
                    )}
                </div>

                <div className="uk-margin">
                    <label className="uk-form-label" htmlFor="category">{t('article.form.category_label')}</label>
                    <div className="uk-form-controls">
                        <select
                            className="uk-select"
                            id="category"
                            value={categoryId || ''}
                            onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}
                        >
                            <option value="">{t('article.form.category_none')}</option>
                            {pickable.map((cat) => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                        </select>
                    </div>
                    <p className="uk-text-meta">
                        {t('article.not_a_project')}{' '}
                        <Link to="/create-project">{t('project.create_title')}</Link>
                    </p>
                </div>

                <div className="uk-margin">
                    <label className="uk-form-label">{t('article.form.type_label')}</label>
                    <div className="uk-form-controls">
                        <label className="uk-margin-small-right">
                            <input
                                className="uk-radio"
                                type="radio"
                                name="articleType"
                                value="post"
                                checked={articleType === 'post'}
                                onChange={() => setArticleType('post')}
                            /> {t('article.form.type_post')}
                        </label>
                        <label>
                            <input
                                className="uk-radio"
                                type="radio"
                                name="articleType"
                                value="link"
                                checked={articleType === 'link'}
                                onChange={() => setArticleType('link')}
                            /> {t('article.form.type_link')}
                        </label>
                    </div>
                </div>

                {articleType === 'link' && (
                    <div className="uk-margin">
                        <label className="uk-form-label" htmlFor="redirectUrl">{t('article.form.redirect_label')}</label>
                        <div className="uk-form-controls">
                            <input
                                className="uk-input"
                                id="redirectUrl"
                                type="url"
                                value={redirectUrl}
                                onChange={(e) => setRedirectUrl(e.target.value)}
                                required
                                placeholder="https://example.com"
                            />
                        </div>
                    </div>
                )}

                <TagsField
                    all={tags}
                    value={{ tagIds: selectedTagIds, newTags }}
                    onChange={(next) => { setSelectedTagIds(next.tagIds); setNewTags(next.newTags); }}
                />

                {articleType === 'post' && (
                    <>
                        <div className="uk-margin">
                            <label className="uk-form-label" htmlFor="content">{t('article.form.content_label')}</label>
                            <div className="uk-form-controls">
                                <ArticleEditor value={content} onChange={handleContentChange} />
                            </div>
                        </div>

                        <div className="uk-margin">
                            <label className="uk-form-label" htmlFor="embedUrl">{t('article.form.embed_label')}</label>
                            <div className="uk-form-controls">
                                <input
                                    className="uk-input"
                                    id="embedUrl"
                                    type="text"
                                    value={embedUrl}
                                    onChange={(e) => setEmbedUrl(e.target.value)}
                                    placeholder="/embeds/my-tool/"
                                />
                            </div>
                            <p className="uk-text-meta">{t('article.form.embed_hint')}</p>
                        </div>

                        {embedUrl && (
                            <div className="uk-margin">
                                <label className="uk-form-label" htmlFor="embedHeight">{t('article.form.embed_height_label')}</label>
                                <div className="uk-form-controls">
                                    <input
                                        className="uk-input"
                                        id="embedHeight"
                                        type="number"
                                        value={embedHeight}
                                        onChange={(e) => setEmbedHeight(Number(e.target.value) || 600)}
                                        min={200}
                                        max={2000}
                                        style={{ width: '120px' }}
                                    />
                                </div>
                            </div>
                        )}
                    </>
                )}

                <div className="uk-margin">
                    {formError && <p className="zx-form-error">{formError}</p>}
                    <button className="uk-button uk-button-primary" type="submit" disabled={isLoading}>
                        {isLoading ? t('article.form.submitting') : t('article.form.submit')}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default CreateArticle;
