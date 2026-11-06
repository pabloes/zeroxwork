import { Link } from 'react-router-dom';
import { useTranslation } from "../i18n";

/** One piece of work as the member endpoint returns it. */
export interface MemberWork {
    id: number;
    title: string;
    slug: string;
    thumbnail: string | null;
    createdAt: string;
    category: string | null;
    tags: { id: number; name: string }[];
}

const TAGS_ON_CARD = 4;

const MemberWorkCard: React.FC<{ work: MemberWork }> = ({ work }) => {
    const { t } = useTranslation();
    const tags = work.tags.slice(0, TAGS_ON_CARD);

    return (
        <Link to={`/view-article/${work.slug}`} className="zx-post zx-proj">
            <div className={`zx-post-thumb${work.thumbnail ? '' : ' zx-post-thumb-empty'}`}>
                {work.thumbnail
                    ? <img src={work.thumbnail} alt="" loading="lazy" />
                    : <span>ZEROxWORK</span>}
            </div>
            <div className="zx-post-body">
                <h3>{work.title}</h3>
                {tags.length > 0 && (
                    <span className="zx-proj-tags">
                        {tags.map((tag) => <span className="zx-chip" key={tag.id}>{tag.name}</span>)}
                    </span>
                )}
                <span className="zx-tool-go">
                    {work.category === 'project' ? t('portfolio.see_project') : t('common.read')} →
                </span>
            </div>
        </Link>
    );
};

export default MemberWorkCard;
