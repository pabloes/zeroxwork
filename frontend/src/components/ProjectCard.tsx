import { Link } from 'react-router-dom';
import { articleExcerpt, articlePath, type Article } from "../services/use-articles";
import { useTranslation } from "../i18n";

const TAGS_ON_CARD = 4;

const ProjectCard: React.FC<{ project: Article }> = ({ project }) => {
    const { t } = useTranslation();
    const summary = articleExcerpt(project);
    const tags = (project.tags ?? []).slice(0, TAGS_ON_CARD);

    return (
        <Link to={articlePath(project)} className="zx-post zx-proj">
            <div className={`zx-post-thumb${project.thumbnail ? '' : ' zx-post-thumb-empty'}`}>
                {project.thumbnail
                    ? <img src={project.thumbnail} alt="" loading="lazy" />
                    : <span>ZEROxWORK</span>}
            </div>
            <div className="zx-post-body">
                <h3>{project.title}</h3>
                {summary && <p className="zx-proj-desc">{summary}</p>}
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
