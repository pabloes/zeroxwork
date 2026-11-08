import { Link } from 'react-router-dom';
import { getNameAvatarImage } from "../services/get-name-avatar-image";
import { useTranslation } from "../i18n";

/** One member as the directory endpoint returns them. The id is the address of
 *  the person; the handle is an alias they may or may not have picked. */
export interface MemberSummary {
    id: number;
    handle: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    memberSince: string;
    walletName: string | null;
    walletAddress: string | null;
    projects: number;
    posts: number;
}

const MemberCard: React.FC<{ member: MemberSummary }> = ({ member }) => {
    const { t } = useTranslation();

    const name = member.displayName || member.walletName || member.handle || `member-${member.id}`;
    const avatar = getNameAvatarImage({
        name: member.walletName,
        address: member.walletAddress,
        avatarUrl: member.avatarUrl,
        // The id, so the face does not change the day they pick a handle.
        seed: member.id,
    });

    // The dictionaries take no arguments, so the count and its word are put
    // together here, with a separate key for the singular.
    const counts: string[] = [];
    if (member.projects > 0) {
        counts.push(`${member.projects} ${t(member.projects === 1 ? 'members.project_one' : 'members.project_many')}`);
    }
    if (member.posts > 0) {
        counts.push(`${member.posts} ${t(member.posts === 1 ? 'members.post_one' : 'members.post_many')}`);
    }

    return (
        <Link to={`/member/${member.handle ?? member.id}`} className="zx-member-card">
            <img className="zx-member-card-avatar" src={avatar} alt="" width={72} height={72} loading="lazy" />
            <div className="zx-member-card-body">
                <h3>{name}</h3>
                {member.handle && <p className="zx-member-card-handle">@{member.handle}</p>}
                <p className="zx-member-card-meta">
                    {counts.length > 0 ? counts.join(' · ') : t('members.nothing_yet')}
                </p>
            </div>
        </Link>
    );
};

export default MemberCard;
