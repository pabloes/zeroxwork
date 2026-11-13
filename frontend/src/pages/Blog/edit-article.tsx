import React, { useState, useEffect } from 'react';
import ArticleEditor from '../../components/editor/ArticleEditor';
import ImagePicker from '../../components/editor/ImagePicker';
import TagsField from '../../components/editor/TagsField';
import { useTranslation } from '../../i18n';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/axios-setup';
import PageTitle from "../../components/PageTitle";
import { useMutation, useQuery } from "@tanstack/react-query";
import UIkit from "uikit";
import { useAuth } from '../../context/AuthContext';
import { slugify } from '../../utils/slug';
import { apiErrorMessage } from '../../services/api-error';
import ProjectMediaField from '../../components/editor/ProjectMediaField';
import { isAllowedVideoUrl, isProjectCategory } from '../../services/project-media';
import { isToolCategory } from '../../services/tool-fields';

const SUPPORTED_LANGS = [
    { code: 'es', name: 'Español' },
    { code: 'en', name: 'English' },
    { code: 'pt-br', name: 'Português (Brasil)' },
    { code: 'zh', name: '中文' },
];

interface Category {
    id: number;
    name: string;
}

interface Tag {
    id: number;
    name: string;
}

const fetchCategories = async (): Promise<Category[]> => {
    const response = await api.get('/blog/categories');
    return response.data;
};

const fetchTags = async (): Promise<Tag[]> => {
    const response = await api.get('/blog/tags');
    return response.data;
};

const EditArticle: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    useAuth(); // ensure authenticated

    // Fetch the article data using useQuery
    const { data: article, isLoading } = useQuery({
        queryKey: ['article', id],
        queryFn: () => fetchArticleById(id as string),
    });

    // Fetch categories and tags
    const { data: categories = [] } = useQuery({
        queryKey: ['categories'],
        queryFn: fetchCategories,
    });

    const { data: tags = [] } = useQuery({
        queryKey: ['tags'],
        queryFn: fetchTags,
    });

    const { t } = useTranslation();
    // Why the last save did not go through, kept next to the submit button.
    const [formError, setFormError] = useState<string | null>(null);

    // Mutation for updating the article
    const mutation = useMutation({
        mutationFn: (updatedArticle: any) => updateArticleById(String(article?.id), updatedArticle),
        onSuccess: () => {
            setFormError(null);
            UIkit.notification(t('article.updated'), "success");
            navigate(`/view-article/${article?.id}`);
        },
        onError: (error) => {
            const message = apiErrorMessage(error, t, 'article.error.update_failed');
            setFormError(message);
            UIkit.notification(message, { status: 'danger', timeout: 7000 });
        }
    });

    // Local state for the form inputs
    const [title, setTitle] = useState<string>(article?.title || '');
    const [content, setContent] = useState<string>(article?.content || '');
    const [thumbnail, setThumbnail] = useState<string>(article?.thumbnail || '');
    const [embedUrl, setEmbedUrl] = useState<string>(article?.embedUrl || '');
    const [embedHeight, setEmbedHeight] = useState<number>(article?.embedHeight || 600);
    const [slug, setSlug] = useState<string>(article?.slug || '');
    const [lang, setLang] = useState<string>(article?.lang || 'es');
    // off while editing: the article already has a slug and rewriting it from the
    // title would break the published URL
    const [autoSlug, setAutoSlug] = useState<boolean>(false);
    const [categoryId, setCategoryId] = useState<number | null>(article?.categoryId || null);
    const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
    const [thumbPickerOpen, setThumbPickerOpen] = useState<boolean>(false);
    const [newTags, setNewTags] = useState<string[]>([]);
    const [articleType, setArticleType] = useState<'post' | 'link'>(article?.type || 'post');
    const [redirectUrl, setRedirectUrl] = useState<string>(article?.redirectUrl || '');
    const [screenshots, setScreenshots] = useState<string[]>(article?.screenshots || []);
    const [videoUrl, setVideoUrl] = useState<string>(article?.videoUrl || '');

    // UseEffect to populate the form when article data is available
    useEffect(() => {
        if (article) {
            setTitle(article.title);
            setContent(article.content);
            setThumbnail(article.thumbnail || '');
            setEmbedUrl(article.embedUrl || '');
            setEmbedHeight(article.embedHeight || 600);
            setSlug(article.slug || '');
            setLang(article.lang || 'es');
            setCategoryId(article.categoryId || null);
            setSelectedTagIds(article.tags?.map((t: Tag) => t.id) || []);
            setArticleType(article.type || 'post');
            setRedirectUrl(article.redirectUrl || '');
            setScreenshots(article.screenshots ?? []);
            setVideoUrl(article.videoUrl ?? '');
        }
    }, [article]);

    // Auto-generate slug from title when autoSlug is enabled
    useEffect(() => {
        if (autoSlug && title) {
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

    const handleContentChange = (value: string) => {
        setContent(value);
    };

    // Which category is selected, by name: only a project carries a gallery.
    const categoryName = categories.find((cat) => cat.id === categoryId)?.name ?? null;
    const isProject = isProjectCategory(categoryName);

    // The portfolio category is no longer on offer: projects have their own
    // table and their own form. The articles that still carry it keep it
    // listed, though -- dropping the option would quietly move them out of
    // their own category the next time somebody saved one. Switching away is a
    // one-way door, which is what we want.
    // Lo mismo vale ahora para las herramientas, que tambien se fueron a su
    // propia tabla: fuera de la lista para los articulos nuevos, pero las que
    // la llevan la conservan.
    const pickable = categories.filter(
        (cat) => (!isProjectCategory(cat.name) && !isToolCategory(cat.name)) || cat.id === categoryId,
    );

    /** Stop the save and say why, in the two places the author is looking. */
    const reject = (key: string) => {
        setFormError(t(key));
        UIkit.notification(t(key), { status: 'warning', timeout: 7000 });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Same guard as the create form: the API rejects a body-less post, and
        // Enter in the title field is enough to submit by accident.
        if (articleType === 'post' && content.trim() === '') {
            setFormError(t('article.error.no_content'));
            UIkit.notification(t('article.error.no_content'), { status: 'warning', timeout: 7000 });
            return;
        }

        // The gallery is asked for when the project is created, not on every
        // edit: the projects the portfolio seed wrote have none, and an edit is
        // how they get one. What an edit does have to be is well formed, so the
        // video host is still checked.
        if (isProject && !isAllowedVideoUrl(videoUrl)) return reject('project.error.video_host');

        setFormError(null);
        mutation.mutate({
            title,
            content: articleType === 'post' ? content : '',
            thumbnail,
            slug,
            lang,
            embedUrl: embedUrl || undefined,
            embedHeight: embedHeight || 600,
            categoryId: categoryId || null,
            tagIds: selectedTagIds,
            newTags: newTags,
            type: articleType,
            redirectUrl: articleType === 'link' ? redirectUrl : undefined,
            screenshots,
            videoUrl: videoUrl.trim() || undefined,
        });
    };


    // Show loading state while fetching the article
    if (isLoading) {
        return <div>{t('common.loading')}</div>;
    }

    return (
        <div className="uk-container uk-margin-large-top">
            <PageTitle title={`${t('article.form.edit_title')}: ${article?.title ?? ''}`} />
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
                        {isProject ? t('project.cover') : t('article.form.thumbnail_label')}
                    </label>
                    <div className="uk-form-controls zx-thumb-field">
                        <input
                            className="uk-input"
                            id="thumbnail"
                            type="text"
                            value={thumbnail}
                            onChange={(e) => setThumbnail(e.target.value)} // Update the thumbnail state
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

                    {/* Display thumbnail preview if a valid URL is present */}
                    {thumbnail && (
                        <div className="uk-margin">
                            <img
                                src={thumbnail}
                                alt={t('article.form.thumbnail_alt')}
                                style={{ maxWidth: '200px', maxHeight: '200px', objectFit: 'cover' }}
/*
                                onError={() => setThumbnail('')} // Clear thumbnail if the URL is invalid
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
                </div>

                {/* A project has to show itself; a post or a tool does not. */}
                {isProject && (
                    <ProjectMediaField
                        screenshots={screenshots}
                        onScreenshotsChange={setScreenshots}
                        videoUrl={videoUrl}
                        onVideoUrlChange={setVideoUrl}
                    />
                )}

                {/* El tipo sólo se pregunta a lo que ya es un enlace. Un artículo
                    nuevo es un artículo: lo de mandar a otro sitio era el apaño de
                    las herramientas cuando vivían aquí, y ahora tienen su propia
                    tabla. Las dos que quedan siguen pudiendo volver a ser texto,
                    que es una puerta de salida y no de entrada. */}
                {articleType === 'link' && (
                    <div className="uk-margin">
                        <label className="uk-form-label">{t('article.form.type_label')}</label>
                        <div className="uk-form-controls">
                            <label className="uk-margin-small-right">
                                <input
                                    className="uk-radio"
                                    type="radio"
                                    name="articleType"
                                    value="post"
                                    checked={false}
                                    onChange={() => setArticleType('post')}
                                /> {t('article.form.type_post')}
                            </label>
                            <label>
                                <input
                                    className="uk-radio"
                                    type="radio"
                                    name="articleType"
                                    value="link"
                                    checked
                                    onChange={() => setArticleType('link')}
                                /> {t('article.form.type_link')}
                            </label>
                        </div>
                        <p className="uk-text-meta">{t('article.form.type_legacy_hint')}</p>
                    </div>
                )}

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
                    <button className="uk-button uk-button-primary" type="submit">
                        {t('article.form.save')}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default EditArticle;


async function fetchArticleById (idOrSlug: string) {
    // Check if it's a numeric ID or a slug
    const isNumeric = /^\d+$/.test(idOrSlug);
    const endpoint = isNumeric
        ? `/blog/articles/${idOrSlug}`
        : `/blog/articles/by-slug/${idOrSlug}`;

    const response = await api.get(endpoint);
    return response.data;
}

async function updateArticleById (id: string, data: any) {
    const response = await api.put(`/blog/articles/${id}`, data);
    return response.data;
}