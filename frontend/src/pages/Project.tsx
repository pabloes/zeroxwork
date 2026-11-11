import ReactMarkdown from 'react-markdown';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from "../i18n";
import { useProject } from "../services/use-projects";
import PageTitle from "../components/PageTitle";
import ProjectGallery from "../components/ProjectGallery";
import MemberList from "../components/MemberList";
import { statusKey } from "../services/project-fields";

/** The year range a project ran for, or nothing when neither date is set. */
function years(startedAt: string | null, endedAt: string | null): string | null {
    const from = startedAt ? new Date(startedAt).getFullYear() : null;
    const to = endedAt ? new Date(endedAt).getFullYear() : null;
    if (from && to) return from === to ? `${from}` : `${from}–${to}`;
    return from ? `${from}–` : to ? `${to}` : null;
}

/** One block of the ficha. Rendered only when it has something in it. */
const Slot: React.FC<{ label: string; note?: string | null; children: React.ReactNode }> =
    ({ label, note, children }) => (
        <div className="zx-ficha-slot">
            <p className="zx-ficha-label">{label}</p>
            {children}
            {note && <p className="zx-ficha-note">{note}</p>}
        </div>
    );

/**
 * One portfolio item at /portfolio/<slug>, or /portfolio/<id>, which always
 * works. Not the article page: a project leads with what it looks like, and
 * its people are members who link to their own pages, not an author byline.
 *
 * The layout is a cover, then the gallery and the write-up beside a ficha of
 * facts. The ficha only shows the facts that exist -- an empty slot disappears
 * instead of leaving a labelled hole -- and when a project has nothing but its
 * credits the ficha gives up the column and becomes a strip above, because one
 * lonely block beside a tall gallery looks like a mistake.
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
    const status = statusKey(project.status);
    const links = project.siteUrl || project.repoUrl;

    // Built as a list so the count can decide the layout further down.
    const slots = [
        project.members.length > 0 && (
            <Slot
                key="credits"
                label={t('project.credits')}
                note={project.members.length > 1 ? t('project.credits_order') : null}
            >
                <MemberList members={project.members} />
            </Slot>
        ),
        project.tags.length > 0 && (
            <Slot key="tags" label={t('project.tags')}>
                <div className="zx-pcard-chips">
                    {project.tags.map((tag) => (
                        <span className="zx-chip" key={tag.id}>{tag.name}</span>
                    ))}
                </div>
            </Slot>
        ),
        ran && (
            <Slot key="period" label={t('project.period')}>
                <p className="zx-ficha-fact">{ran}</p>
            </Slot>
        ),
        status && (
            <Slot key="state" label={t('project.state')}>
                <div className="zx-pcard-chips">
                    <span className={`zx-chip zx-chip--${project.status}`}>{t(status)}</span>
                </div>
            </Slot>
        ),
        links && (
            <Slot key="links" label={t('project.links')}>
                <div className="zx-ficha-btns">
                    {project.siteUrl && (
                        <a
                            className="zx-ficha-btn zx-ficha-btn--pri"
                            href={project.siteUrl}
                            target="_blank"
                            rel="noreferrer noopener"
                        >
                            {t('project.visit')}<span aria-hidden="true">→</span>
                        </a>
                    )}
                    {project.repoUrl && (
                        <a
                            className="zx-ficha-btn"
                            href={project.repoUrl}
                            target="_blank"
                            rel="noreferrer noopener"
                        >
                            {t('project.repository')}<span aria-hidden="true">→</span>
                        </a>
                    )}
                </div>
            </Slot>
        ),
    ].filter(Boolean);

    // One slot cannot hold a column of its own beside a tall gallery.
    const solo = slots.length <= 1;
    const ficha = <aside className={`zx-ficha${solo ? ' zx-ficha--strip' : ''}`}>{slots}</aside>;

    return (
        <div className="zx-wrap zx-page">
            {!project.published && (
                <div className="uk-alert uk-alert-warning uk-margin-small-bottom" uk-alert="">
                    {t('project.draft_notice')}{' '}
                    <Link to="/my-projects">{t('project.draft_go_publish')}</Link>
                </div>
            )}

            {/* Only whoever entered it, and an admin, are told it can be edited. */}
            {project.canEdit && (
                <p>
                    <Link className="uk-button uk-button-secondary" to={`/edit-project/${project.id}`}>
                        {t('project.edit_cta')}
                    </Link>
                </p>
            )}

            <p className="zx-proj-crumb">
                <Link to="/portfolio">{t('nav.portfolio')}</Link> / {project.title}
            </p>

            <PageTitle title={project.title} className="zx-proj-h1" />
            {project.summary && <p className="zx-proj-lead">{project.summary}</p>}

            {/* One image the author uploaded. A diptych is theirs to compose. */}
            {project.thumbnail && (
                <div className="zx-proj-cover">
                    <img src={project.thumbnail} alt={project.title} />
                </div>
            )}

            <div className={`zx-proj-cols${solo ? ' zx-proj-cols--solo' : ''}`}>
                {solo && ficha}

                <div>
                    {/* What it looks like comes before what it says about itself. */}
                    <ProjectGallery
                        title={project.title}
                        screenshots={project.screenshots}
                        videoUrl={project.videoUrl}
                    />

                    <section className="zx-proj-body markdown-body" id="article-content">
                        <ReactMarkdown>{project.content}</ReactMarkdown>
                    </section>
                </div>

                {!solo && ficha}
            </div>
        </div>
    );
};

export default ProjectPage;
