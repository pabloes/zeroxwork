import { useQuery } from '@tanstack/react-query';
import { api } from "../services/axios-setup";
import { useTranslation } from "../i18n";
import MemberCard, { type MemberSummary } from "../components/MemberCard";

/**
 * Everyone who set a public handle, with what they have shipped. Setting the
 * handle is what puts somebody here, so nobody is listed without choosing to be.
 */
const Members: React.FC = () => {
    const { t } = useTranslation();

    const { data: members = [], isLoading } = useQuery<MemberSummary[]>({
        queryKey: ['members'],
        queryFn: async () => (await api.get('/user/members')).data,
    });

    return (
        <div className="zx-wrap zx-page">
            <div className="zx-page-head">
                <div className="zx-eyebrow" style={{ color: 'var(--zx-blue)' }}>{t('nav.members')}</div>
                <h1 className="zx-sec-title">{t('members.title')}</h1>
                <p className="zx-sec-sub">{t('members.sub')}</p>
            </div>

            {members.length > 0 ? (
                <div className="zx-member-grid">
                    {members.map((member) => (
                        <MemberCard key={member.handle} member={member} />
                    ))}
                </div>
            ) : (
                <div className="zx-empty">
                    {isLoading ? t('common.loading') : t('members.empty')}
                </div>
            )}
        </div>
    );
};

export default Members;
