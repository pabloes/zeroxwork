import React, { useState, useEffect } from 'react';
import ArticleEditor from '../../components/editor/ArticleEditor';
import ImagePicker from '../../components/editor/ImagePicker';
import { useTranslation } from '../../i18n';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/axios-setup';
import PageTitle from "../../components/PageTitle";
import { useMutation, useQuery } from "@tanstack/react-query";
import UIkit from "uikit";
import { useAuth } from '../../context/AuthContext';
import { slugify } from '../../utils/slug';
import { apiErrorMessage } from '../../services/api-error';
import CreditsField, { type CreditDraft } from '../../components/editor/CreditsField';
import ProjectMediaField from '../../components/editor/ProjectMediaField';
import { isAllowedVideoUrl, isProjectCategory } from '../../services/project-media';

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
    const [newTagInput, setNewTagInput] = useState<string>('');
    const [thumbPickerOpen, setThumbPickerOpen] = useState<boolean>(false);
    const [newTags, setNewTags] = useState<string[]>([]);
    const [credits, setCredits] = useState<CreditDraft[]>([]);
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
            setCredits((article.credits ?? []).map((credit: any) => ({
                name: credit.name,
                role: credit.role || '',
                userId: credit.userId ?? null,
                handle: credit.handle ?? null,
            })));
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

    const handleTagToggle = (tagId: number) => {
        setSelectedTagIds(prev =>
            prev.includes(tagId)
                ? prev.filter(id => id !== tagId)
                : [...prev, tagId]
        );
    };

    const handleAddNewTag = () => {
        const trimmed = newTagInput.trim();
        if (trimmed && !newTags.includes(trimmed)) {
            setNewTags(prev => [...prev, trimmed]);
            setNewTagInput('');
        }
    };

    const handleRemoveNewTag = (tagName: string) => {
        setNewTags(prev => prev.filter(t => t !== tagName));
    };

    // Which category is selected, by name: only a project carries a gallery.
    const categoryName = categories.find((cat) => cat.id === categoryId)?.name ?? null;
    const isProject = isProjectCategory(categoryName);

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
            credits: credits.map((credit) => ({
                name: credit.name,
                role: credit.role || undefined,
                userId: credit.userId ?? undefined,
                handle: credit.handle ?? undefined,
            })),
            screenshots,
            videoUrl: videoUrl.trim() || undefined,
        });
    };


    // Show loading state while fetching the article
    if (isLoading) {
        return <div>Loading...</div>;
    }

    return (
        <div className="uk-container uk-margin-large-top">
            <PageTitle title={`Edit post: ${article?.title}`} />
            <form className="uk-form-stacked" onSubmit={handleSubmit}>
                <div className="uk-margin">
                    <label className="uk-form-label" htmlFor="title">Title:</label>
                    <div className="uk-form-controls">
                        <input
                            className="uk-input"
                            id="title"
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            required
                            placeholder="Enter article title"
                        />
                    </div>
                </div>

                <div className="uk-margin">
                    <label className="uk-form-label" htmlFor="slug">Slug:</label>
                    <div className="uk-form-controls uk-grid-small uk-flex-middle" uk-grid="">
                        <div className="uk-width-expand">
                            <input
                                className="uk-input"
                                id="slug"
                                type="text"
                                value={slug}
                                onChange={handleSlugChange}
                                placeholder="article-url-slug"
                            />
                        </div>
                        <div>
                            <label>
                                <input
                                    className="uk-checkbox"
                                    type="checkbox"
                                    checked={autoSlug}
                                    onChange={(e) => setAutoSlug(e.target.checked)}
                                /> auto-slug
                            </label>
                        </div>
                    </div>
                </div>

                <div className="uk-margin">
                    <label className="uk-form-label" htmlFor="lang">Language:</label>
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
                        {isProject ? t('project.cover') : 'Thumbnail URL:'}
                    </label>
                    <div className="uk-form-controls zx-thumb-field">
                        <input
                            className="uk-input"
                            id="thumbnail"
                            type="text"
                            value={thumbnail}
                            onChange={(e) => setThumbnail(e.target.value)} // Update the thumbnail state
                            placeholder="Enter image URL"
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
                                alt="Thumbnail preview"
                                style={{ maxWidth: '200px', maxHeight: '200px', objectFit: 'cover' }}
/*
                                onError={() => setThumbnail('')} // Clear thumbnail if the URL is invalid
*/
                            />
                        </div>
                    )}
                </div>

                <div className="uk-margin">
                    <label className="uk-form-label" htmlFor="category">Category:</label>
                    <div className="uk-form-controls">
                        <select
                            className="uk-select"
                            id="category"
                            value={categoryId || ''}
                            onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}
                        >
                            <option value="">No category</option>
                            {categories.map((cat) => (
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

                <div className="uk-margin">
                    <label className="uk-form-label">Article Type:</label>
                    <div className="uk-form-controls">
                        <label className="uk-margin-small-right">
                            <input
                                className="uk-radio"
                                type="radio"
                                name="articleType"
                                value="post"
                                checked={articleType === 'post'}
                                onChange={() => setArticleType('post')}
                            /> Post
                        </label>
                        <label>
                            <input
                                className="uk-radio"
                                type="radio"
                                name="articleType"
                                value="link"
                                checked={articleType === 'link'}
                                onChange={() => setArticleType('link')}
                            /> Link
                        </label>
                    </div>
                </div>

                {articleType === 'link' && (
                    <div className="uk-margin">
                        <label className="uk-form-label" htmlFor="redirectUrl">Redirect URL:</label>
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

                <div className="uk-margin">
                    <label className="uk-form-label">Tags:</label>
                    <div className="uk-form-controls">
                        {tags.length > 0 && (
                            <div className="uk-margin-small-bottom">
                                {tags.map((tag) => (
                                    <label key={tag.id} className="uk-margin-small-right" style={{ display: 'inline-block' }}>
                                        <input
                                            className="uk-checkbox"
                                            type="checkbox"
                                            checked={selectedTagIds.includes(tag.id)}
                                            onChange={() => handleTagToggle(tag.id)}
                                        /> {tag.name}
                                    </label>
                                ))}
                            </div>
                        )}
                        <div className="uk-grid-small uk-flex-middle" uk-grid="">
                            <div className="uk-width-expand">
                                <input
                                    className="uk-input"
                                    type="text"
                                    value={newTagInput}
                                    onChange={(e) => setNewTagInput(e.target.value)}
                                    placeholder="Add new tag..."
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleAddNewTag();
                                        }
                                    }}
                                />
                            </div>
                            <div>
                                <button
                                    type="button"
                                    className="uk-button uk-button-default"
                                    onClick={handleAddNewTag}
                                >
                                    Add
                                </button>
                            </div>
                        </div>
                        {newTags.length > 0 && (
                            <div className="uk-margin-small-top">
                                <span className="uk-text-meta">New tags: </span>
                                {newTags.map((tagName) => (
                                    <span key={tagName} className="uk-label uk-margin-small-right">
                                        {tagName}
                                        <a
                                            href="#"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                handleRemoveNewTag(tagName);
                                            }}
                                            style={{ marginLeft: '5px', color: 'white' }}
                                        >
                                            ×
                                        </a>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <CreditsField value={credits} onChange={setCredits} />

                {articleType === 'post' && (
                    <>
                        <div className="uk-margin">
                            <label className="uk-form-label" htmlFor="content">Content (Markdown):</label>
                            <div className="uk-form-controls">
                                <ArticleEditor value={content} onChange={handleContentChange} />
                            </div>
                        </div>

                        <div className="uk-margin">
                            <label className="uk-form-label" htmlFor="embedUrl">Embed URL (optional):</label>
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
                            <p className="uk-text-meta">
                                Internal paths (e.g. /embeds/my-tool/) or approved external URLs (e.g. https://pabloes.github.io/...). Use [iframe] in the content to position it, or it will be appended at the end.
                            </p>
                        </div>

                        {embedUrl && (
                            <div className="uk-margin">
                                <label className="uk-form-label" htmlFor="embedHeight">Embed Height (px):</label>
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
                        Update
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