import React from 'react';
import ReactMarkdown from 'react-markdown';
import {api} from "../../services/axios-setup";
import {useParams, Link} from 'react-router-dom';
import PageTitle from "../../components/PageTitle";
import {useAuth} from "../../context/AuthContext";
import {useQuery} from "@tanstack/react-query";
import {getNameAvatarImage} from "../../services/get-name-avatar-image";
import {authorLabel, type ArticleCredit, type ArticleTag} from "../../services/use-articles";
import MemberList from "../../components/MemberList";
import FichaSlot from "../../components/FichaSlot";
import ProjectGallery from "../../components/ProjectGallery";
import DonateButton from "../../components/DonateButton";
import { getIframeSandbox } from "../../utils/iframe-sandbox";
import {ROLE} from "../../constants/roles";
import {useTranslation} from "../../i18n";

// Each language in its own name: a reader looking for theirs recognises it
// written that way, whatever language the page around it is in.
const LANG_NAMES: Record<string, string> = {
    'es': 'Español',
    'en': 'English',
    'pt-br': 'Português',
    'zh': '中文',
    'fr': 'Français',
};

/**
 * One article at /view-article/<slug>, or /view-article/<id>.
 *
 * It wears the portfolio page's layout on purpose: cover first, then the
 * write-up beside a ficha of facts, with the same classes (portfolio.scss).
 * An article and a project are the same shape of page, and one set of rules
 * is easier to keep honest than two that drift apart. What an article has and
 * a project does not is a byline and the language notices (article.scss).
 *
 * The ficha only shows the facts that exist. With one slot it gives up the
 * column and becomes a strip above the text, as on the project page; with
 * none it is not there at all.
 */
const ArticlePage: React.FC = () => {
    const {user} = useAuth();
    const {t, lang} = useTranslation();
    const {id} = useParams<{ id: string }>();
    // Fetch the article using useQuery
    const { data: article } = useQuery({
        queryKey: ['article', id], // Unique key based on the article ID
        queryFn: () => fetchArticleById(id as string), // Pass the id to the fetch function
    });

    if (!article) {
        return <div className="zx-wrap zx-page"><div className="zx-empty">{t('common.loading')}</div></div>;
    }

    // The reader's language is the one the interface is in. It used to be read
    // from a separate localStorage key that is only written when somebody
    // changes language by hand, so a first-time visitor whose language came
    // from the browser was always taken for an English reader, and a Spanish
    // one reading the Spanish text was offered "a translation in your
    // language: English".
    const userLang: string = lang;
    const hreflang: { lang: string; slug: string }[] = article.hreflang || [];

    // Find if there's a translation in user's language
    const userLangTranslation = hreflang.find((h) => h.lang === userLang);
    const showTranslationAvailable = article.lang !== userLang && userLangTranslation;

    // Check if this is a translation
    const {isTranslation, originalLang, originalSlug} = article;

    const canEdit = user && (user.role === ROLE.ADMIN || user.userId === article.userId);

    // The author, shaped like a credit so the byline can be the same chip the
    // portfolio uses for its people: a face, a name, and an arrow to their
    // member page when there is one to go to. The avatar keeps the article's
    // own rules (uploaded, then Decentraland or Base, then generated).
    const name = authorLabel(article);
    const author: ArticleCredit | null = name ? {
        name,
        role: null,
        userId: article.userId ?? null,
        handle: article.authorHandle ?? null,
        avatarUrl: getNameAvatarImage({
            name: article.author,
            address: article.authorAddress,
            avatarUrl: article.authorAvatar,
            seed: article.authorAddress ?? name,
        }),
    } : null;
    const locale = lang === 'pt-br' ? 'pt-BR' : lang;
    const publishedOn = new Date(article.createdAt).toLocaleDateString(locale);
    const updatedOn = new Date(article.updatedAt).toLocaleDateString(locale);

    const credits = article.credits ?? [];
    const tags: ArticleTag[] = article.tags ?? [];

    // Built as a list so the count can decide the layout further down. The
    // labels are the portfolio's: the same words, already in five languages.
    const slots = [
        credits.length > 0 && (
            <FichaSlot key="credits" label={t('project.credits')}>
                <MemberList members={credits} />
            </FichaSlot>
        ),
        tags.length > 0 && (
            <FichaSlot key="tags" label={t('project.tags')}>
                <div className="zx-pcard-chips">
                    {tags.map((tag) => (
                        <span className="zx-chip" key={tag.id}>{tag.name}</span>
                    ))}
                </div>
            </FichaSlot>
        ),
        // Where the portfolio's ficha ends in its links, an article's ends in
        // the one thing a reader can do for whoever wrote it.
        article.authorAddress && (
            <FichaSlot key="donate" label={t('article.donate_label')}>
                <div className="zx-donate">
                    <DonateButton donationAddress={article.authorAddress} />
                </div>
            </FichaSlot>
        ),
    ].filter(Boolean);

    // One slot cannot hold a column of its own beside a long text.
    const solo = slots.length <= 1;
    const ficha = slots.length > 0
        ? <aside className={`zx-ficha${solo ? ' zx-ficha--strip' : ''}`}>{slots}</aside>
        : null;

    return (
        <div className="zx-wrap zx-page">
            {/* Only its author and an admin can reach a draft at all, so this is
                a reminder rather than a warning: the page looks live otherwise. */}
            {article.published === false && (
                <div className="zx-note zx-note--draft">
                    {t('article.draft_notice')}{' '}
                    <Link to="/my-articles">{t('article.draft_go_publish')}</Link>
                </div>
            )}

            {/* Language notices. The link is the language's own name, so the
                sentence before it needs no placeholder to be translated. */}
            {showTranslationAvailable && (
                <div className="zx-note">
                    {t('article.translation_available')}{' '}
                    <Link to={`/view-article/${userLangTranslation.slug}`}>
                        {LANG_NAMES[userLang] || userLang}
                    </Link>
                </div>
            )}

            {isTranslation && originalLang && originalSlug && originalLang !== userLang && (
                <div className="zx-note">
                    {t('article.is_translation')}{' '}
                    <Link to={`/view-article/${originalSlug}`}>
                        {LANG_NAMES[originalLang] || originalLang}
                    </Link>
                </div>
            )}

            {canEdit && (
                <p>
                    <Link className="uk-button uk-button-secondary" to={`/edit-article/${id}`}>
                        {t('article.edit')}
                    </Link>
                </p>
            )}

            <p className="zx-proj-crumb">
                <Link to="/blog">{t('nav.blog')}</Link> / {article.title}
            </p>

            <PageTitle title={article.title} className="zx-proj-h1" />

            <div className="zx-byline">
                {author && <MemberList members={[author]} />}
                <span>{publishedOn}</span>
                {/* Only when it says something the first date does not. */}
                {updatedOn !== publishedOn && (
                    <span className="zx-byline-upd">{t('article.last_update')} {updatedOn}</span>
                )}
            </div>

            {/* The cover leads, as on a project: it is the image the author
                chose to stand for the article, and the card on /blog already
                promised it. */}
            {article.thumbnail && (
                <div className="zx-proj-cover">
                    <img src={article.thumbnail} alt={article.title} />
                </div>
            )}

            <div className={`zx-proj-cols${solo ? ' zx-proj-cols--solo' : ''}`}>
                {solo && ficha}

                <div>
                    <ProjectGallery
                        title={article.title}
                        screenshots={article.screenshots}
                        videoUrl={article.videoUrl}
                    />

                    <section className="zx-proj-body zx-article-body markdown-body" id="article-content">
                        {article.embedUrl && article.content.includes('[iframe]') ? (
                            <>
                                {article.content.split('[iframe]').map((part: string, i: number) => (
                                    <React.Fragment key={i}>
                                        {i > 0 && (
                                            <iframe
                                                src={article.embedUrl}
                                                title={article.title}
                                                style={{ border: 'none', width: '100%', height: `${article.embedHeight || 600}px` }}
                                                sandbox={getIframeSandbox(article.embedUrl)}
                                                loading="lazy"
                                            />
                                        )}
                                        <ReactMarkdown>{part}</ReactMarkdown>
                                    </React.Fragment>
                                ))}
                            </>
                        ) : (
                            <>
                                <ReactMarkdown>{article.content}</ReactMarkdown>
                                {article.embedUrl && (
                                    <iframe
                                        src={article.embedUrl}
                                        title={article.title}
                                        style={{ border: 'none', width: '100%', height: `${article.embedHeight || 600}px` }}
                                        sandbox={getIframeSandbox(article.embedUrl)}
                                        loading="lazy"
                                    />
                                )}
                            </>
                        )}
                    </section>
                </div>

                {!solo && ficha}
            </div>
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

    // Handle link-type articles - redirect to external URL
    if (response.data.type === 'link' && response.data.redirectUrl) {
        window.location.href = response.data.redirectUrl;
        return null;
    }

    return response.data;
}
