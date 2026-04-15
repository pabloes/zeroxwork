import { Link, useLocation } from 'react-router-dom';
import logo from '../../public/zeroxwork-logo.png';
import { useAuth } from "../context/AuthContext";
import { useTranslation, SUPPORTED_LANGS, type SupportedLang } from "../i18n";

const LANG_NAMES: Record<SupportedLang, string> = {
    'en': 'EN',
    'es': 'ES',
    'pt-br': 'PT',
    'zh': 'ZH',
};

const Header: React.FC = () => {
    const { isAuthenticated, logout } = useAuth();
    const location = useLocation();
    const { lang, setLanguage, t } = useTranslation();

    const handleLogout = () => {
        logout();
        window.location.href = '/';
    };

    const isActive = (path: string) => {
        if (path === '/blog') {
            return location.pathname === '/' || location.pathname.startsWith('/blog') ||
                   location.pathname.startsWith('/view-article') || location.pathname.startsWith('/articles');
        }
        return location.pathname.startsWith(path);
    };

    return (
        <header className="uk-background-muted uk-padding-small">
            <nav className="uk-navbar-container uk-navbar" uk-navbar="true">
                <div className="uk-navbar-left">
                    <a href="/" className="uk-navbar-item uk-logo">
                        <img src={logo} alt="ZEROxWORK Logo" width="120" />
                    </a>
                </div>

                <div className="uk-navbar-center">
                    <ul className="uk-navbar-nav">
                        <li className={isActive('/blog') ? 'uk-active' : ''}>
                            <Link to="/">{t('nav.blog')}</Link>
                        </li>
                        <li className={isActive('/tools') ? 'uk-active' : ''}>
                            <Link to="/tools">{t('nav.tools')}</Link>
                        </li>
                    </ul>
                </div>

                <div className="uk-navbar-right">
                    <div className="uk-navbar-item">
                        <select
                            className="uk-select uk-form-small"
                            value={lang}
                            onChange={(e) => setLanguage(e.target.value as SupportedLang)}
                            style={{ width: '80px' }}
                        >
                            {SUPPORTED_LANGS.map((l) => (
                                <option key={l} value={l}>{LANG_NAMES[l]}</option>
                            ))}
                        </select>
                    </div>
                    <ul className="uk-navbar-nav">
                        {isAuthenticated ? (
                            <>
                                <li>
                                    <a href="#">{t('nav.my_account')}</a>
                                    <div className="uk-navbar-dropdown">
                                        <ul className="uk-nav uk-navbar-dropdown-nav">
                                            <li><Link to="/my-articles">{t('nav.my_articles')}</Link></li>
                                            <li><Link to="/my-images">{t('nav.my_images')}</Link></li>
                                            <li className="uk-nav-divider"></li>
                                            <li><Link to="/account">{t('nav.settings')}</Link></li>
                                            <li className="uk-nav-divider"></li>
                                            <li>
                                                <a onClick={handleLogout} className="uk-text-danger">
                                                    {t('nav.logout')}
                                                </a>
                                            </li>
                                        </ul>
                                    </div>
                                </li>
                            </>
                        ) : (
                            <>
                                <li><Link to="/register">{t('nav.register')}</Link></li>
                                <li><Link to="/login">{t('nav.login')}</Link></li>
                            </>
                        )}
                    </ul>
                </div>
            </nav>
        </header>
    );
};

export default Header;
