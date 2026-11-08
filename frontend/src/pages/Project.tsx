import ReactMarkdown from 'react-markdown';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from "../i18n";
import { useProject } from "../services/use-projects";
import PageTitle from "../components/PageTitle";
import ProjectGallery from "../components/ProjectGallery";
import CreditList from "../components/CreditList";

/** The year range a project ran for, or nothing when neither date is set. */
function years(startedAt: string | null, endedAt: string | null): string | null {
    const from = startedAt ? new Date(startedAt).getFullYear() : null;
    const to = endedAt ? new Date(endedAt).getFullYear() : null;
    if (from && to) return from === to ? `${from}` : `${from}–${to}`;
    return from ? `${from}–` : to ? `${to}` : null;
}

/**
 * One portfolio item at /portfolio/<slug>, or /portfolio/<id>, which always
 * works. Not the article page: a project leads with what it looks like, and
 * its people are members who link to their own pages, not an author byline.
 */
const ProjectPage: React.FC = () => {
    const { idOrSlug = '' } = useParams();
    const { t } = useTranslation();
    const { data: project, isLoading, isError } = useProject(idOrSlug);

    if (isLoading) {
        return <div className="zx-wrap zx-page"><div className="zx-empty">{t('common.loading')}</div></div>;
    }

    if (isError || !project) {
        return (
            <div className="zx-wrap zx-page">
                <div className="zx-page-head">
                    <h1 className="zx-sec-title">{t('project.not_found_title')}</h1>
                    <p className="zx-sec-sub">{t('project.not_found')}</p>
                    <p><Link to="/portfolio">{t('project.back_to_portfolio')}</Link></p>
                </div>
            </div>
        );
    }

    const ran = years(project.startedAt, project.endedAt);

    return (
        <div className="zx-wrap zx-page">
            {!project.published && (
                <div className="uk-alert uk-alert-warning uk-margin-small-bottom" uk-alert="">
                    {t('project.draft_notice')}
                </div>
            )}

            <div className="zx-page-head">
                <div className="zx-eyebrow" style={{ color: 'var(--zx-orange)' }}>
                    <Link to="/portfolio">{t('nav.portfolio')}</Link>
                </div>
                <PageTitle title={project.title} />
                {project.summary && <p className="zx-sec-sub">{project.summary}</p>}
            </div>

            {/* What it looks like comes before what it says about itself. */}
            <ProjectGallery
                title={project.title}
                screenshots={project.screenshots}
                videoUrl={project.videoUrl}
            />

            <div className="zx-proj-meta">
                {/* Who made it. Each member with an account links to their page. */}
                <CreditList credits={project.members} withLabel />

                <div className="zx-proj-facts">
                    {ran && <span className="zx-chip">{ran}</span>}
                    {project.status && <span className="zx-chip">{project.status}</span>}
                    {project.tags.map((tag) => (
                        <span className="zx-chip" key={tag.id}>{tag.name}</span>
                    ))}
                </div>

                {(project.siteUrl || project.repoUrl) && (
                    <p className="zx-proj-links">
                        {project.siteUrl && (
                            <a className="zx-btn zx-btn-primary" href={project.siteUrl} target="_blank" rel="noreferrer noopener">
                                {t('project.visit')} →
                            </a>
                        )}
                        {project.repoUrl && (
                            <a className="zx-btn" href={project.repoUrl} target="_blank" rel="noreferrer noopener">
                                {t('project.repository')} →
                            </a>
                        )}
                    </p>
                )}
            </div>

            <div className="markdown-body" id="article-content">
                <ReactMarkdown>{project.content}</ReactMarkdown>
            </div>
        </div>
    );
};

export default ProjectPage;
