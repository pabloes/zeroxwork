import React, { useState, useMemo, useEffect } from 'react';
import SimpleMDE from 'react-simplemde-editor';
import 'easymde/dist/easymde.min.css';
import { useParams, useNavigate } from 'react-router-dom'; // Assuming you're using React Router
import { api } from '../../services/axios-setup';
import PageTitle from "../../components/PageTitle"; // Import your Axios instance

const EditArticle: React.FC = () => {
    const { id } = useParams<{ id: string }>(); // Get article ID from the URL
    const navigate = useNavigate();
    const [article, setArticle] = useState({});
    const [title, setTitle] = useState<string>('');
    const [content, setContent] = useState<string>('');
    const [thumbnail, setThumbnail] = useState<string>(''); // State for the thumbnail URL
    const [isLoading, setIsLoading] = useState<boolean>(true); // Loading state for data fetch

    // Fetch the existing article data on mount
    useEffect(() => {
        const fetchArticle = async () => {
            try {
                const response = await api.get(`/blog/articles/${id}`);
                const article = response.data;
                setArticle(article);
                setTitle(article.title);
                setContent(article.content);
                setThumbnail(article.thumbnail || ''); // Set the thumbnail if available
                setIsLoading(false);
            } catch (error) {
                console.error('Error fetching article:', error);
                alert('Error fetching article');
                setIsLoading(false);
            }
        };

        fetchArticle();
    }, [id]);

    // Handle article content change
    const handleContentChange = (value: string) => {
        setContent(value);
    };

    // Handle article update
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.put(`/blog/articles/${id}`, {
                title,
                content,
                thumbnail, // Send thumbnail to backend
            });
            alert('Article updated successfully!');
            navigate(`/view-article/${id}`); // Redirect to blog page or article list after update
        } catch (error) {
            console.error('Error updating article:', error);
            alert('Error updating article');
        }
    };

    // Memoize the options for SimpleMDE to avoid losing focus
    const editorOptions = useMemo(() => {
        return {
            placeholder: "Edit your content...",
            spellChecker: false,
        } as SimpleMDE.Options;
    }, []);

    // Show loading state while fetching the article
    if (isLoading) {
        return <div>Loading...</div>;
    }

    return (
        <div className="uk-container uk-margin-large-top">
            <PageTitle title={`Edit post: ${article.title}`} />
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
                                onError={() => setThumbnail('')} // Clear thumbnail if the URL is invalid
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
