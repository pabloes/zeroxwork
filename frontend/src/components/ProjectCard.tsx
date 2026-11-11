import { Link } from 'react-router-dom';
import { projectExcerpt, projectPath, type Project } from "../services/use-projects";
import { useTranslation } from "../i18n";
import MemberList from "./MemberList";

const TAGS_ON_CARD = 4;
/** More than this and the card becomes a contact sheet with a title on top. */
const THUMBS_ON_CARD = 3;

/**
 * A project in the portfolio grid, in the same language as its own page: the
 * cover leads, a sliver of the gallery follows, and the people are faces
 * rather than underlined names.
 *
 * The strip of screenshots is the point of the card. A cover says what a
 * project is called; three shots under it say what it is actually like, which
 * is what decides whether anyone clicks.
 */
const ProjectCard: React.FC<{ project: Project }> = ({ project }) => {
    const { t } = useTranslation();
    const summary = projectExcerpt(project);
    const tags = project.tags.slice(0, TAGS_ON_CARD);
    const thumbs = (project.screenshots ?? [])
        .filter((url) => typeof url === 'string' && url !== '')
        .slice(0, THUMBS_ON_CARD);

    return (
        <Link to={projectPath(project)} className="zx-pcard">
            {project.thumbnail
                ? (
                    <div className="zx-pcard-cover">
                        <img src={project.thumbnail} alt="" loading="lazy" />
                    </div>
                )
                : <div className="zx-pcard-empty">ZEROxWORK</div>}

            {/* Only a full row: one or two shots under a cover read as a gap. */}
            {thumbs.length === THUMBS_ON_CARD && (
                <div className="zx-pcard-thumbs">
                    {thumbs.map((url) => <img key={url} src={url} alt="" loading="lazy" />)}
                </div>
            )}

            <div className="zx-pcard-body">
                <h3 className="zx-pcard-title">{project.title}</h3>
                {summary && <p className="zx-pcard-desc">{summary}</p>}

                {/* linked={false}: the whole card is already a link */}
                <MemberList members={project.members} linked={false} />

                {tags.length > 0 && (
                    <div className="zx-pcard-chips">
                        {tags.map((tag) => (
                            <span className="zx-chip" key={tag.id}>{tag.name}</span>
                        ))}
                    </div>
                )}

                <span className="zx-pcard-go">{t('portfolio.see_project')} →</span>
            </div>
        </Link>
    );
};

export default ProjectCard;
