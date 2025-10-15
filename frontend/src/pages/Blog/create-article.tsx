import React, { useState, useMemo } from 'react';
import SimpleMDE from 'react-simplemde-editor';
import 'easymde/dist/easymde.min.css';
import { useNavigate } from 'react-router-dom';
import UIkit from 'uikit';
import { useMutation } from '@tanstack/react-query'; // Import React Query's useMutation
import { api } from '../../services/axios-setup'; // Import your Axios instance
import { useAuth } from '../../context/AuthContext';

// Service function for creating a new article
const createArticle = async (newArticle: { title: string; content: string; thumbnail: string; script?: string }) => {
    const response = await api.post('/blog/articles', newArticle);
    return response.data;
};

const CreateArticle: React.FC = () => {
    const [title, setTitle] = useState<string>('');
    const [content, setContent] = useState<string>('');
    const [script, setScript] = useState<string>(''); // ADMIN-only script
    const [thumbnail, setThumbnail] = useState<string>(''); // State for thumbnail URL
    const navigate = useNavigate();
    const { user } = useAuth();

    const mutation = useMutation({
        mutationFn: createArticle,
        onSuccess: (data) => {
            console.log("data", data);
            UIkit.notification('Article created successfully!', { status: 'success' });
            navigate(`/view-article/${data.id}`); // Navigate to the created article
        },
        onError: (error) => {
            console.log("error", error);
            UIkit.notification('Error creating article.', { status: 'danger' });
        },
    });

// Instead of destructuring `isLoading`, destructure `status` from mutation
    const { status } = mutation;

/*    const handleThumbnailError = (error:any)=>{
        console.error(error);
        debugger;
        setThumbnail("")
    }*/

    // Handle article content change
    const handleContentChange = (value: string) => {
        setContent(value);
    };

    // Handle form submission for creating an article
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Trigger the mutation
        mutation.mutate({
            title,
            content,
            thumbnail,
            script: user?.role === 'ADMIN' ? script : undefined,
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
                {JSON.stringify(user)}
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

                {user?.role === 'ADMIN' && (
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
