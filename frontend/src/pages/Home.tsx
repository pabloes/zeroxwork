import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom'; // Assuming you're using React Router
import { api } from '../services/axios-setup'; // Fixed the import path for Axios

interface Article {
    id: number;
    title: string;
    thumbnail: string | null;  // Thumbnail is optional (nullable in your schema)
    createdAt: string;         // Use createdAt as the publication date
}

const HomeDashboard: React.FC = () => {
    const [articles, setArticles] = useState<Article[]>([]);

    // Fetch articles on component mount
    useEffect(() => {
        const fetchArticles = async () => {
            try {
                const response = await api.get('/blog/articles');
                setArticles(response.data);
            } catch (error) {
                console.error('Error fetching articles:', error);
            }
        };

        fetchArticles();
    }, []);

    return (
        <div className="uk-container uk-margin-large-top">
            <div className="uk-grid uk-flex-center" uk-grid="true">
                {articles.map(article => (
                    <div className="uk-flex uk-width-1-2@m uk-width-1-2@s" key={article.id}>
                        <Link to={`/view-article/${article.id}`} className="uk-link-reset uk-flex-first">
                            <div className="uk-card uk-card-hover">
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
                    </div>
                ))}
            </div>
        </div>
    );
};

export default HomeDashboard;
