import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from "../context/AuthContext";
import { useTranslation, SUPPORTED_LANGS, type SupportedLang } from "../i18n";
import { getTheme, setTheme, type Theme } from "../services/theme";
import LangFlag from "./LangFlag";
import ZxMark from "./ZxMark";

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
    const [theme, setThemeState] = useState<Theme>(getTheme);
    const [menuOpen, setMenuOpen] = useState(false);

    const handleLogout = () => {
        logout();
        window.location.href = '/';
    };

    const toggleTheme = () => {
        const next: Theme = theme === 'light' ? 'dark' : 'light';
        setTheme(next);
        setThemeState(next);
    };

    const isActive = (path: string) => {
        if (path === '/blog') {
            return location.pathname.startsWith('/blog') ||
                   location.pathname.startsWith('/view-article') || location.pathname.startsWith('/articles');
        }
        return location.pathname.startsWith(path);
    };

    return (
        <header className="zx-header">
            <div className="zx-wrap zx-nav">
                <Link to="/" className="zx-brand" aria-label="ZEROxWORK">
                    <ZxMark />
                    <span className="zx-wordmark"><span className="z">ZEROx</span>WORK</span>
                </Link>

                <div className="zx-nav-right">
                    <nav className="zx-nav-links">
                        <Link to="/blog" className={isActive('/blog') ? 'is-active' : ''}>{t('nav.blog')}</Link>
                        <Link to="/tools" className={isActive('/tools') ? 'is-active' : ''}>{t('nav.tools')}</Link>
                        {!isAuthenticated && <Link to="/register" className="zx-nav-cta">{t('nav.join')} →</Link>}
                    </nav>

                    <span className="zx-lang-wrap">
                        <LangFlag lang={lang} className="zx-lang-flag" />
                        <select
                            className="zx-lang"
                            value={lang}
                            onChange={(e) => setLanguage(e.target.value as SupportedLang)}
                            aria-label={t('nav.language')}
                        >
                            {SUPPORTED_LANGS.map((l) => (
                                <option key={l} value={l}>{LANG_NAMES[l]}</option>
                            ))}
                        </select>
                    </span>

                    <button
                        type="button"
                        className="zx-icon-btn zx-theme-btn"
                        onClick={toggleTheme}
                        aria-label={theme === 'light' ? t('theme.to_dark') : t('theme.to_light')}
                    >
                        <svg className="i-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                            <circle cx="12" cy="12" r="4" />
                            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                        </svg>
                        <svg className="i-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
                        </svg>
                    </button>

                    {isAuthenticated ? (
                        <details className="zx-menu" open={menuOpen} onToggle={(e) => setMenuOpen((e.target as HTMLDetailsElement).open)}>
                            <summary className="zx-icon-btn" aria-label={t('nav.my_account')}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="8" r="4" />
                                    <path d="M4 21a8 8 0 0 1 16 0" />
                                </svg>
                            </summary>
                            <div className="zx-menu-panel" onClick={() => setMenuOpen(false)}>
                                <Link to="/my-articles">{t('nav.my_articles')}</Link>
                                <Link to="/my-images">{t('nav.my_images')}</Link>
                                <hr />
                                <Link to="/account">{t('nav.settings')}</Link>
                                <hr />
                                <a className="danger" onClick={handleLogout}>{t('nav.logout')}</a>
                            </div>
                        </details>
                    ) : (
                        <>
                            <Link to="/login" className="zx-nav-cta zx-hide-sm">{t('nav.login')}</Link>
                            <Link to="/login" className="zx-icon-btn zx-only-sm" aria-label={t('nav.login')}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="8" r="4" />
                                    <path d="M4 21a8 8 0 0 1 16 0" />
                                </svg>
                            </Link>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Header;
