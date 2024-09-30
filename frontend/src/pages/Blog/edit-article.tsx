import React, { useState, useMemo, useEffect } from 'react';
import SimpleMDE from 'react-simplemde-editor';
import 'easymde/dist/easymde.min.css';
import { useParams, useNavigate } from 'react-router-dom'; // Assuming you're using React Router
import { api } from '../../services/axios-setup';
import PageTitle from "../../components/PageTitle";
import {useMutation, useQuery} from "@tanstack/react-query";
import UIkit from "uikit"; // Import your Axios instance

const EditArticle: React.FC = () => {
    const { id } = useParams<{ id: string }>(); // Get article ID from the URL
    const navigate = useNavigate();


    // Fetch the article data using useQuery
    const { data: article, isLoading } = useQuery({
        queryKey: ['article', id],
        queryFn: () => fetchArticleById(id as string),
    });

    // Mutation for updating the article
    const mutation = useMutation({
        mutationFn: (updatedArticle: any) => updateArticleById(id as string, updatedArticle),
        onSuccess: () => {
            UIkit.notification('Article updated successfully!', "success");
            navigate(`/view-article/${id}`);
        },
        onError: () => {
            UIkit.notification('Article updated successfully!', "error");
        }
    });
    // Local state for the form inputs
    const [title, setTitle] = useState<string>(article?.title || '');
    const [content, setContent] = useState<string>(article?.content || '');
    const [thumbnail, setThumbnail] = useState<string>(article?.thumbnail || '');
    // UseEffect to populate the form when article data is available
    useEffect(() => {
        if (article) {
            setTitle(article.title);
            setContent(article.content);
            setThumbnail(article.thumbnail || '');
        }
    }, [article]);

    // Handle article content change
    const handleContentChange = (value: string) => {
        setContent(value);
    };

    // Handle article update
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        mutation.mutate({ title, content, thumbnail }); // Trigger the mutation
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
                    <label className="uk-form-label" htmlFor="content">Content (Markdown):</label>
                    <div className="uk-form-controls">
                        <SimpleMDE
                            value={content}
                            onChange={handleContentChange}
                            options={editorOptions}
                        />
                    </div>
                </div>

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