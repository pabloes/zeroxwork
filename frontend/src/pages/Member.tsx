import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from "../services/axios-setup";
import { getNameAvatarImage } from "../services/get-name-avatar-image";
import { useTranslation } from "../i18n";
import MemberWorkCard, { type MemberWork } from "../components/MemberWorkCard";

interface MemberProfile {
    /** The address that never moves. The handle is an alias and may be absent. */
    id: number;
    handle: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    memberSince: string;
    walletName: string | null;
    walletAddress: string | null;
    socials: { network: string; handle: string }[];
    works: MemberWork[];
}

/** Public page of one member: who they are and everything they are credited on. */
const Member: React.FC = () => {
    // Either an id or a handle: the backend answers to both and the route does
    // not need to know which one it was given.
    const { idOrHandle = '' } = useParams();
    const { t, lang } = useTranslation();

    const { data: member, isLoading, isError } = useQuery<MemberProfile>({
        queryKey: ['member', idOrHandle, lang],
        queryFn: async () => (await api.get(`/user/members/${idOrHandle}?lang=${lang}`)).data,
        retry: false,
    });

    if (isLoading) {
        return <div className="zx-wrap zx-page"><div className="zx-empty">{t('common.loading')}</div></div>;
    }

    if (isError || !member) {
        return (
            <div className="zx-wrap zx-page">
                <div className="zx-page-head">
                    <h1 className="zx-sec-title">{t('member.not_found_title')}</h1>
                    <p className="zx-sec-sub">{t('member.not_found')}</p>
                </div>
            </div>
        );
    }

    const name = member.displayName || member.walletName || member.handle || `member-${member.id}`;
    const avatar = getNameAvatarImage({
        name: member.walletName,
        address: member.walletAddress,
        avatarUrl: member.avatarUrl,
        // The id, so the generated avatar stays the same face if they later
        // pick a handle or change the one they have.
        seed: member.id,
    });

    // Projects first, then anything else they have written.
    const projects = member.works.filter((work) => work.category === 'project');
    const rest = member.works.filter((work) => work.category !== 'project');

    return (
        <div className="zx-wrap zx-page">
            <header className="zx-member-head">
                <img className="zx-member-avatar" src={avatar} alt="" width={112} height={112} />
                <div>
                    <h1 className="zx-member-name">{name}</h1>
                    {member.handle && <p className="zx-member-handle">@{member.handle}</p>}
                    {member.walletName && member.walletName !== name && (
                        <p className="zx-member-meta">{member.walletName}</p>
                    )}
                    {member.socials.length > 0 && (
                        <ul className="zx-member-socials">
                            {member.socials.map((social) => (
                                <li key={social.network}>
                                    <span className="zx-member-network">{social.network}</span>
                                    <span className="zx-member-social-handle">{social.handle}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </header>

            {projects.length > 0 && (
                <section className="zx-member-section">
                    <h2 className="zx-sec-title">{t('member.projects')}</h2>
                    <div className="zx-card-grid">
                        {projects.map((work) => <MemberWorkCard key={work.id} work={work} />)}
                    </div>
                </section>
            )}

            {rest.length > 0 && (
                <section className="zx-member-section">
                    <h2 className="zx-sec-title">{t('member.other_work')}</h2>
                    <div className="zx-card-grid">
                        {rest.map((work) => <MemberWorkCard key={work.id} work={work} />)}
                    </div>
                </section>
            )}

            {member.works.length === 0 && (
                <div className="zx-empty">{t('member.no_work')}</div>
            )}
        </div>
    );
};

export default Member;
