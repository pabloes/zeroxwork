import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'; // React Query for data fetching and mutations
import { api } from '../../services/axios-setup'; // Axios instance for API requests
import UIkit from 'uikit'; // UIkit for notifications
import ConfirmActionModal from '../../components/ConfirmActionModal'; // Import the confirmation modal

// Service function to fetch user's articles
const fetchMyArticles = async () => {
    const response = await api.get('/blog/my-articles'); // Endpoint for user's articles
    return response.data;
};

// Service function to delete an article by ID
const deleteArticle = async (articleId: number) => {
    await api.delete(`/blog/articles/${articleId}`);
};

interface Article {
    id: number;
    title: string;
    thumbnail: string | null;
    createdAt: string;
    updatedAt: string;
}

const MyArticles: React.FC = () => {
    const queryClient = useQueryClient(); // Access the QueryClient to invalidate queries

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [articleToDelete, setArticleToDelete] = useState<Article | null>(null);

    // Use React Query to fetch articles
    const { data: articles = [], isLoading, error } = useQuery({
        queryKey: ['my-articles'],
        queryFn: fetchMyArticles,
    });

    // Mutation for deleting an article
    const mutation = useMutation({
        mutationFn: (articleId: number) => deleteArticle(articleId),
        onSuccess: () => {
            UIkit.notification('Article deleted successfully!', { status: 'success' });
            queryClient.invalidateQueries(['my-articles']); // Invalidate and refetch the updated list
        },
        onError: () => {
            UIkit.notification('Error deleting article.', { status: 'danger' });
        }
    });

    // Open the modal for deleting an article
    const openDeleteModal = (article: Article) => {
        setArticleToDelete(article);
        setShowModal(true);
    };

    // Close the modal
    const closeDeleteModal = () => {
        setShowModal(false);
        setArticleToDelete(null);
    };

    // Handle delete action when confirmed
    const handleDelete = (articleId: number) => {
        mutation.mutate(articleId); // Trigger the mutation to delete the article
        closeDeleteModal(); // Close the modal after confirming the delete
    };

    // Show loading or error states if necessary
    if (isLoading) {
        return <div>Loading articles...</div>;
    }

    if (error) {
        return <div>Error fetching articles.</div>;
    }

    return (
        <div className="uk-container uk-margin-large-top">
            <div className="uk-flex uk-flex-between uk-flex-middle">
                <Link to={`/create-article`} className="uk-button uk-button-primary">
                    ✙ Create new article
                </Link>
            </div>
            <br/>
            <div className="uk-grid-small uk-child-width-1-3@s uk-child-width-1-4@m uk-grid-match" data-uk-grid>
                {articles.map(article => (
                    <div className="uk-flex uk-width-1-3@m uk-width-1-2@s" key={article.id}>
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
                        <div className="uk-flex-column uk-margin-small-top">
                            <Link to={`/edit-article/${article.id}`} className="uk-button uk-button-secondary uk-margin-small-bottom">
                               ✏️️  Edit
                            </Link>
                            <button
                                className="uk-button uk-button-danger uk-margin-small-bottom"
                                onClick={() => openDeleteModal(article)} // Trigger modal on click
                            >
                               🗑️️ Delete
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Confirmation Modal for Deletion */}
            {articleToDelete && (
                <ConfirmActionModal
                    show={showModal}
                    onClose={closeDeleteModal}
                    onConfirm={() => {
                        if (articleToDelete) {
                            handleDelete(articleToDelete.id);
                        }
                    }}
                    title="Confirm Deletion"
                    message={`Are you sure you want to delete the article "${articleToDelete.title}"? This action cannot be undone.`}
                    confirmButtonText="Delete"
                    cancelButtonText="Cancel"
                    wordToType="delete"
                    imageSrc={articleToDelete.thumbnail || ''} // Pass the URL of the article's thumbnail
                />
            )}
        </div>
    );
};

export default MyArticles;
