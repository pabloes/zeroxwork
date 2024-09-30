import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import {api} from "../../services/axios-setup";

const ArticlePage: React.FC<{ id: number }> = ({ id }) => {
    const [article, setArticle] = useState<any>(null);

    useEffect(() => {
        const fetchArticle = async () => {
            try {
                const response = await api.get(`/articles/${id}`); // Use api.get to fetch article
                setArticle(response.data);
            } catch (error) {
                console.error('Error fetching article:', error);
            }
        };

        fetchArticle();
    }, [id]);

    return (
        <div>
            {article ? (
                <>
                    <h1>{article.title}</h1>
                    <ReactMarkdown>{article.content}</ReactMarkdown>
                </>
            ) : (
                <p>Loading...</p>
            )}
        </div>
    );
};

export default ArticlePage;
