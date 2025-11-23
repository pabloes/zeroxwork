import React, { useState, useMemo, useEffect } from 'react';
import SimpleMDE from 'react-simplemde-editor';
import 'easymde/dist/easymde.min.css';
import { useNavigate } from 'react-router-dom';
import UIkit from 'uikit';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../../services/axios-setup';
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

// Service function for creating a new article
const createArticle = async (newArticle: {
    title: string;
    content: string;
    thumbnail: string;
    slug?: string;
    lang?: string;
    script?: string;
    categoryId?: number | null;
    tagIds?: number[];
    newTags?: string[];
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
    const [title, setTitle] = useState<string>('');
    const [content, setContent] = useState<string>('');
    const [script, setScript] = useState<string>('');
    const [thumbnail, setThumbnail] = useState<string>('');
    const [slug, setSlug] = useState<string>('');
    const [lang, setLang] = useState<string>(() => localStorage.getItem('blogLang') || 'en');
    const [autoSlug, setAutoSlug] = useState<boolean>(true);
    const [categoryId, setCategoryId] = useState<number | null>(null);
    const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
    const [newTagInput, setNewTagInput] = useState<string>('');
    const [newTags, setNewTags] = useState<string[]>([]);
    const navigate = useNavigate();
    const { user } = useAuth();

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
            UIkit.notification('Article created successfully!', { status: 'success' });
            navigate(`/view-article/${data.id}`);
        },
        onError: (error) => {
            console.log("error", error);
            UIkit.notification('Error creating article.', { status: 'danger' });
        },
    });

    const { status } = mutation;

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
            slug: slug || undefined,
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
            placeholder: 'Write your content...',
            spellChecker: false,
        };
    }, []);
// Check the status for loading state
    const isLoading = status === 'pending';

    return (
        <div className="uk-container uk-margin-large-top">
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
                            onChange={(e) => setThumbnail(e.target.value)} // Update thumbnail state
                            placeholder="Enter image URL"
                        />
                    </div>

                    {/* Display thumbnail preview if valid URL is present */}
                    {thumbnail && (
                        <div className="uk-margin">
                            <img
                                src={thumbnail}
                                alt="Thumbnail preview"
                                style={{ maxWidth: '200px', maxHeight: '200px', objectFit: 'cover' }}
/*
                                onError={handleThumbnailError} // Clear thumbnail if URL is invalid
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
                    <button className="uk-button uk-button-primary" type="submit" disabled={isLoading}>
                        {isLoading ? 'Submitting...' : 'Submit'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default CreateArticle;
