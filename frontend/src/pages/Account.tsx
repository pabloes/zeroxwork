import { useState } from 'react';
import { Link } from 'react-router-dom';
import AccountQuota from '../components/AccountQuota';
import AccountSecurity from '../components/AccountSecurity';
import BindDiscord from '../components/BindDiscord';
import BindWallet from '../components/BindWallet';
import PageTitle from '../components/PageTitle';
import ProfileBadge from '../components/ProfileBadge';
import ProfileForm from '../components/ProfileForm';
import { useTranslation } from '../i18n';

/**
 * Everything about the account, in the order somebody actually asks it:
 * who I am here, how I show that elsewhere, how I get in, what I have linked,
 * how much room I have left, and where the things I made are.
 *
 * Each block is a panel of its own and brings its own spacing, so this page
 * only decides the order -- which is why there is nothing here but the list.
 */
const AccountPage: React.FC = () => {
    const { t } = useTranslation();
    // Bumped on anything that changes what the other blocks show: a saved
    // profile redraws the badge, a linked wallet moves the quota.
    const [changes, setChanges] = useState(0);
    const changed = () => setChanges((count) => count + 1);

    return (
        <div className="zx-wrap zx-account">
            <header className="zx-account-head">
                <PageTitle title={t('account.title')} className="zx-account-title" />
                <p className="zx-account-sub">{t('account.sub')}</p>
            </header>

            <ProfileForm onSaved={changed} />
            <ProfileBadge changes={changes} />
            <AccountSecurity />
            <BindDiscord />
            <BindWallet onAddWallet={changed} onRemoveWallet={changed} />
            <AccountQuota changes={changes} />

            <nav className="zx-panel">
                <h3 className="zx-panel-title">{t('account.yours_title')}</h3>
                <p className="zx-panel-sub">{t('account.yours_sub')}</p>
                <div className="zx-account-links">
                    <Link className="zx-btn zx-btn-ghost" to="/my-articles">{t('nav.my_articles')}</Link>
                    <Link className="zx-btn zx-btn-ghost" to="/my-projects">{t('nav.my_projects')}</Link>
                    <Link className="zx-btn zx-btn-ghost" to="/my-tools">{t('nav.my_tools')}</Link>
                    <Link className="zx-btn zx-btn-ghost" to="/my-images">{t('nav.my_images')}</Link>
                </div>
            </nav>
        </div>
    );
};

export default AccountPage;
