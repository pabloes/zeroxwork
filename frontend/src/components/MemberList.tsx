import { Link } from 'react-router-dom';
import type { ArticleCredit } from '../services/use-articles';
import { avatarFor } from '../services/member-avatar';

interface Props {
    members: ArticleCredit[];
    /**
     * false inside a card that is itself one big link: a link within a link is
     * invalid markup and the inner one swallows the card's own click.
     */
    linked?: boolean;
}

/**
 * Who made a project, as chips with a face.
 *
 * Underlined names in a row read as a bibliography; a project is made by
 * people, and people have faces. Somebody with an account gets their photo and
 * an arrow to their page; somebody credited by name alone gets a disc with
 * their initials and no arrow, because a link to nowhere is worse than none.
 *
 * Articles keep CreditList: an article has an author and a byline reads right
 * there. This is for the project page, where the list is the point.
 */
const MemberList: React.FC<Props> = ({ members, linked = true }) => {
    if (members.length === 0) return null;

    return (
        <div className="zx-people">
            {members.map((member, index) => {
                const target = member.handle ?? member.userId;
                const inside = (
                    <>
                        <img className="zx-person-img" src={avatarFor(member)} alt="" loading="lazy" />
                        <span className="zx-person-name">{member.name}</span>
                        {member.role && <span className="zx-person-role">{member.role}</span>}
                    </>
                );

                return linked && target ? (
                    <Link
                        key={`${member.name}-${index}`}
                        to={`/member/${target}`}
                        className="zx-person zx-person--linked"
                    >
                        {inside}
                        <span className="zx-person-arrow" aria-hidden="true">↗</span>
                    </Link>
                ) : (
                    <span key={`${member.name}-${index}`} className="zx-person zx-person--plain">
                        {inside}
                    </span>
                );
            })}
        </div>
    );
};

export default MemberList;
