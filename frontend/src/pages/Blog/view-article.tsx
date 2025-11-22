import ReactMarkdown from 'react-markdown';
import {api} from "../../services/axios-setup";
import {useParams} from 'react-router-dom';
import PageTitle from "../../components/PageTitle";
import {useAuth} from "../../context/AuthContext";
import {useNavigate} from 'react-router-dom';
import {useQuery} from "@tanstack/react-query";
import {getNameAvatarImage} from "../../services/get-name-avatar-image";
import DonateButton from "../../components/DonateButton";
import InlineArticleScriptRunner from "../../components/InlineArticleScriptRunner";
import {ROLE} from "../../constants/roles";

const ArticlePage: React.FC = () => {
    const {user} = useAuth();
    const {id} = useParams<{ id: string }>();
    const navigate = useNavigate();
    // Fetch the article using useQuery
    const { data: article } = useQuery({
        queryKey: ['article', id], // Unique key based on the article ID
        queryFn: () => fetchArticleById(id as string), // Pass the id to the fetch function
    });

    const handleEditClick = ()=> {
        navigate(`/edit-article/${id}`)
    }
    return (
        <div className="uk-container uk-section">
            {user && (user?.role === ROLE.ADMIN || user?.userId === article?.userId) && (
                <button className="uk-button uk-button-primary" onClick={handleEditClick}>
                    Edit Article
                </button>
            )}
            {article ? (
                <div className="uk-card uk-card-default uk-card-body markdown-body">
                    <p className="uk-text-meta">
                        <b>Published on:&nbsp;</b>{new Date(article.createdAt).toLocaleDateString()}&nbsp;|&nbsp;
                        <b>Last update:&nbsp;</b>{new Date(article.updatedAt).toLocaleDateString()}&nbsp;|&nbsp;
                        <b>Author:</b>&nbsp;<img
                        src={getNameAvatarImage({name:article.author, address:article.authorAddress })}
                        alt="Author Avatar"
                        className="uk-border-circle"
                        style={{ width: '32px', height: '32px', marginRight: '10px', float:"none", marginLeft:"6px" }}
                    />{article.author}
                    </p>
                    <PageTitle title={article.title}/>
                    <div id="article-content">
                        <ReactMarkdown>{article.content}</ReactMarkdown>
                    </div>
                    {article.script && (
                        <InlineArticleScriptRunner
                            code={article.script}
                            targetSelector="#article-content"
                        />
                    )}
                    <div>
                        {article.authorAddress && <div className="uk-card uk-card-default">
                            Make a donation to the author of this article:<br/>
                            <DonateButton donationAddress={article.authorAddress} />
                        </div>}
                    </div>
                </div>
            ) : (
                <p>Loading...</p>
            )}
        </div>
    );
};

export default ArticlePage;

async function fetchArticleById (idOrSlug: string) {
    // Check if it's a numeric ID or a slug
    const isNumeric = /^\d+$/.test(idOrSlug);
    const endpoint = isNumeric
        ? `/blog/articles/${idOrSlug}`
        : `/blog/articles/by-slug/${idOrSlug}`;

    const response = await api.get(endpoint);

    // Handle 301 redirect
    if (response.data.redirect && response.data.slug) {
        window.location.href = `/view-article/${response.data.slug}`;
        return null;
    }

    return response.data;
}