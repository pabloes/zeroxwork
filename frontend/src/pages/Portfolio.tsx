import { useMemo, useState } from 'react';
import { useTranslation } from "../i18n";
import { collectTagNames } from "../services/use-articles";
import { useProjects } from "../services/use-projects";
import ProjectCard from "../components/ProjectCard";

// below this there is nothing to filter, so the tag row stays hidden
const MIN_TAGS_TO_FILTER = 2;

const Portfolio: React.FC = () => {
    const { t } = useTranslation();
    const { data: projects = [], isLoading } = useProjects();
    const [activeTag, setActiveTag] = useState<string | null>(null);

    const tagNames = useMemo(() => collectTagNames(projects), [projects]);

    const visible = activeTag
        ? projects.filter((project) => project.tags.some((tag) => tag.name === activeTag))
        : projects;

    return (
        <div className="zx-wrap zx-page">
            <div className="zx-page-head">
                <div className="zx-eyebrow" style={{ color: 'var(--zx-orange)' }}>{t('nav.portfolio')}</div>
                <h1 className="zx-sec-title">{t('portfolio.title')}</h1>
                <p className="zx-sec-sub">{t('portfolio.sub')}</p>
            </div>

            {tagNames.length >= MIN_TAGS_TO_FILTER && (
                <div className="zx-filter-row" role="group" aria-label={t('portfolio.filter_label')}>
                    <button
                        type="button"
                        className={`zx-chip zx-chip-btn${activeTag === null ? ' is-active' : ''}`}
                        onClick={() => setActiveTag(null)}
                        aria-pressed={activeTag === null}
                    >
                        {t('portfolio.filter_all')}
                    </button>
                    {tagNames.map((name) => (
                        <button
                            type="button"
                            key={name}
                            className={`zx-chip zx-chip-btn${activeTag === name ? ' is-active' : ''}`}
                            onClick={() => setActiveTag(activeTag === name ? null : name)}
                            aria-pressed={activeTag === name}
                        >
                            {name}
                        </button>
                    ))}
                </div>
            )}

            {visible.length > 0 ? (
                <div className="zx-card-grid">
                    {visible.map((project) => (
                        <ProjectCard key={project.id} project={project} />
                    ))}
                </div>
            ) : (
                <div className="zx-empty">
                    {isLoading
                        ? t('common.loading')
                        : activeTag ? t('portfolio.empty_tag') : t('common.empty')}
                </div>
            )}
        </div>
    );
};

export default Portfolio;
