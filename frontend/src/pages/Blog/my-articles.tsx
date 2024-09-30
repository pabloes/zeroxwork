import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom'; // Assuming you're using React Router
import { api } from '../../services/axios-setup'; // Axios instance for API requests

interface Article {
    id: number;
    title: string;
    thumbnail: string | null;  // Thumbnail is optional (nullable in your schema)
    createdAt: string;         // Use createdAt as the publication date
}

const MyArticles: React.FC = () => {
    const [articles, setArticles] = useState<Article[]>([]);

    // Fetch articles created by the authenticated user
    useEffect(() => {
        const fetchMyArticles = async () => {
            try {
                const response = await api.get('/blog/my-articles'); // Assuming you have an endpoint for the user's articles
                setArticles(response.data);
            } catch (error) {
                console.error('Error fetching articles:', error);
            }
        };

        fetchMyArticles();
    }, []);

    return (
        <div className="uk-container uk-margin-large-top">
            <h2>Your Articles</h2>
            <div className="uk-grid-small uk-child-width-1-3@s uk-child-width-1-4@m uk-grid-match" data-uk-grid>
                {articles.map(article => (
                    <div className="uk-flex uk-width-1-3@m uk-width-1-2@s" key={article.id}>
                        <Link to={`/view-article/${article.id}`} className="uk-link-reset uk-flex-first">
                            <div className="uk-card uk-card-default uk-card-hover">
                                <div className="uk-cover-container">
                                    {article.thumbnail ? (
                                        <img
                                            src={article.thumbnail}
                                            alt={article.title}
                                            data-uk-cover
                                        />
                                    ) : (
                                        <div className="uk-placeholder">No image available</div>
                                    )}
                                    <canvas width="600" height="400"></canvas> {/* Placeholder for aspect ratio */}

                                    {/* Overlay with title and publication date */}
                                    <div className="uk-overlay uk-overlay-primary uk-position-bottom uk-light">
                                        <h3 className="uk-card-title">{article.title}</h3>
                                        <p className="uk-text-meta">Published on: {new Date(article.createdAt).toLocaleDateString()}</p>
                                    </div>
                                </div>
                            </div>
                        </Link>
                        {/* Add an "Edit" button */}
                        <Link to={`/edit-article/${article.id}`} className="uk-button uk-button-secondary uk-margin-small-top">
                            Edit
                        </Link>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default MyArticles;
