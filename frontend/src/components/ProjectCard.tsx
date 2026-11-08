import { Link } from 'react-router-dom';
import { projectExcerpt, projectPath, type Project } from "../services/use-projects";
import { useTranslation } from "../i18n";
import CreditList from "./CreditList";

const TAGS_ON_CARD = 4;

const ProjectCard: React.FC<{ project: Project }> = ({ project }) => {
    const { t } = useTranslation();
    const summary = projectExcerpt(project);
    const tags = project.tags.slice(0, TAGS_ON_CARD);
    // Members, not credits: a project has no author to tell them apart from.
    const credits = project.members;

    return (
        <Link to={projectPath(project)} className="zx-post zx-proj">
            <div className={`zx-post-thumb${project.thumbnail ? '' : ' zx-post-thumb-empty'}`}>
                {project.thumbnail
                    ? <img src={project.thumbnail} alt="" loading="lazy" />
                    : <span>ZEROxWORK</span>}
            </div>
            <div className="zx-post-body">
                <h3>{project.title}</h3>
                {summary && <p className="zx-proj-desc">{summary}</p>}
                {/* linked={false}: the whole card is already a link */}
                <CreditList credits={credits} linked={false} />
                {tags.length > 0 && (
                    <span className="zx-proj-tags">
                        {tags.map((tag) => (
                            <span className="zx-chip" key={tag.id}>{tag.name}</span>
                        ))}
                    </span>
                )}
                <span className="zx-tool-go">{t('portfolio.see_project')} →</span>
            </div>
        </Link>
    );
};

export default ProjectCard;
