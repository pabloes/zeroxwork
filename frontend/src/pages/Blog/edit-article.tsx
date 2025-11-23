import React, { useState, useMemo, useEffect } from 'react';
import SimpleMDE from 'react-simplemde-editor';
import 'easymde/dist/easymde.min.css';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/axios-setup';
import PageTitle from "../../components/PageTitle";
import { useMutation, useQuery } from "@tanstack/react-query";
import UIkit from "uikit";
import { useAuth } from '../../context/AuthContext';
import { ROLE } from '../../constants/roles';
import { slugify } from '../../utils/slug';

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
    const { user } = useAuth();

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

    // Mutation for updating the article
    const mutation = useMutation({
        mutationFn: (updatedArticle: any) => updateArticleById(String(article?.id), updatedArticle),
        onSuccess: () => {
            UIkit.notification('Article updated successfully!', "success");
            navigate(`/view-article/${article?.slug || article?.id}`);
        },
        onError: () => {
            UIkit.notification('Error updating article.', "error");
        }
    });

    // Local state for the form inputs
    const [title, setTitle] = useState<string>(article?.title || '');
    const [content, setContent] = useState<string>(article?.content || '');
    const [thumbnail, setThumbnail] = useState<string>(article?.thumbnail || '');
    const [script, setScript] = useState<string>(article?.script || '');
    const [slug, setSlug] = useState<string>(article?.slug || '');
    const [lang, setLang] = useState<string>(article?.lang || 'es');
    const [autoSlug, setAutoSlug] = useState<boolean>(true);
    const [categoryId, setCategoryId] = useState<number | null>(article?.categoryId || null);
    const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
    const [newTagInput, setNewTagInput] = useState<string>('');
    const [newTags, setNewTags] = useState<string[]>([]);

    // UseEffect to populate the form when article data is available
    useEffect(() => {
        if (article) {
            setTitle(article.title);
            setContent(article.content);
            setThumbnail(article.thumbnail || '');
            setScript(article.script || '');
            setSlug(article.slug || '');
            setLang(article.lang || 'es');
            setCategoryId(article.categoryId || null);
            setSelectedTagIds(article.tags?.map((t: Tag) => t.id) || []);
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

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        mutation.mutate({
            title,
            content,
            thumbnail,
            slug,
            lang,
            script: user?.role === ROLE.ADMIN ? script : undefined,
            categoryId: categoryId || null,
            tagIds: selectedTagIds,
            newTags: newTags,
        });
    };

    // Memoize the options for SimpleMDE to avoid losing focus
    const editorOptions = useMemo(() => {
        return {
            placeholder: "Edit your content...",
            spellChecker: false,
        };
    }, []);

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
                    <label className="uk-form-label" htmlFor="thumbnail">Thumbnail URL:</label>
                    <div className="uk-form-controls">
                        <input
                            className="uk-input"
                            id="thumbnail"
                            type="url"
                            value={thumbnail}
                            onChange={(e) => setThumbnail(e.target.value)} // Update the thumbnail state
                            placeholder="Enter image URL"
                        />
                    </div>

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

                <div className="uk-margin">
                    <label className="uk-form-label" htmlFor="content">Content (Markdown):</label>
                    <div className="uk-form-controls">
                        <SimpleMDE
                            value={content}
                            onChange={handleContentChange}
                            options={editorOptions}
                        />
                    </div>
                </div>

                {user?.role === ROLE.ADMIN && (
                    <div className="uk-margin">
                        <label className="uk-form-label" htmlFor="script">Script (optional, ADMIN only):</label>
                        <div className="uk-form-controls">
                            <textarea
                                className="uk-textarea"
                                id="script"
                                rows={10}
                                value={script}
                                onChange={(e) => setScript(e.target.value)}
                                placeholder={`// Example:\n// import getHtmlCode from 'https://cdn.jsdelivr.net/npm/my-lib@1.0.0/dist/index.esm.js';\n// getArticleElement().append(getHtmlCode());\n// or dynamic:\n// const { default: fn } = await import('lodash-es');\n// getArticleElement().append(fn())`}
                            />
                        </div>
                        <p className="uk-text-meta">
                            The script runs in-page (not sandboxed). Use getArticleElement() to manipulate the rendered Markdown.
                            Static and dynamic imports are supported. Bare specifiers (e.g., 'lodash-es') auto-resolve via jsdelivr CDN; full URLs also work.
                            Your code can access browser APIs (e.g., localStorage) and the current page context.
                        </p>
                    </div>
                )}

                <div className="uk-margin">
                    <button className="uk-button uk-button-primary" type="submit">
                        Update
                    </button>
                </div>
            </form>
        </div>
    );
};

export default EditArticle;


async function fetchArticleById (id: string) {
    const response = await api.get(`/blog/articles/${id}`);
    return response.data;
}

async function updateArticleById (id: string, data: any) {
    const response = await api.put(`/blog/articles/${id}`, data);
    return response.data;
}