import React, {useEffect, useState} from 'react';
import ReactMarkdown from 'react-markdown';
import {api} from "../../services/axios-setup";
import {useParams} from 'react-router-dom';
import PageTitle from "../../components/PageTitle";
import {useAuth} from "../../context/AuthContext";
import {useNavigate} from 'react-router-dom';

const ArticlePage: React.FC = () => {
    const [article, setArticle] = useState<any>(null);
    const {user} = useAuth();
    const {id} = useParams<{ id: string }>();
    const navigate = useNavigate();
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
    const handleEditClick = ()=> {
        navigate(`/edit-article/${id}`)
    }
    return (
        <div className="uk-container uk-section">
            {user && user?.userId === article?.userId && (
                <button className="uk-button uk-button-primary" onClick={handleEditClick}>
                    Edit Article
                </button>
            )}
            {article ? (
                <div className="uk-card uk-card-default uk-card-body markdown-body">
                    <p className="uk-text-meta">
                        <b>Published on:&nbsp;</b>{new Date(article.createdAt).toLocaleDateString()}&nbsp;|&nbsp;
                        <b>Last update:&nbsp;</b>{new Date(article.updatedAt).toLocaleDateString()}&nbsp;|&nbsp;
                        {/*<b>Author:</b>&nbsp;{article.author.name}*/}
                    </p>
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
