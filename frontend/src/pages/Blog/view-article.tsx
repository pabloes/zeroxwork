import React, {useEffect, useState} from 'react';
import ReactMarkdown from 'react-markdown';
import {api} from "../../services/axios-setup";
import {useParams} from 'react-router-dom';
import PageTitle from "../../components/PageTitle";

const ArticlePage: React.FC = () => {
    const [article, setArticle] = useState<any>(null);
    const {id} = useParams<{ id: string }>();

    useEffect(() => {
        const fetchArticle = async () => {
            try {
                const response = await api.get(`/blog/articles/${id}`); // Use api.get to fetch article
                setArticle(response.data);
            } catch (error) {
                console.error('Error fetching article:', error);
            }
        };

        fetchArticle();
    }, [id]);

    return (
        <div className="uk-container uk-section">
            {article ? (
                <div className="markdown-body">

                    <PageTitle title={article.title}/>
                    <ReactMarkdown>{article.content}</ReactMarkdown>
                </div>
            ) : (
                <p>Loading...</p>
            )}
        </div>
    );
};

export default ArticlePage;
