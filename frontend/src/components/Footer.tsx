import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from "../i18n";

const Footer: React.FC = () => {
    const { t } = useTranslation();

    return (
        <footer className="zx-footer">
            <div className="zx-wrap zx-foot-in">
                <Link to="/" className="zx-brand" aria-label="ZEROxWORK">
                    <span className="zx-mark" role="img" aria-label="ZEROxWORK" />
                    <span className="zx-wordmark"><span className="z">ZEROx</span>WORK</span>
                </Link>

                <div className="zx-foot-links">
                    <Link to="/blog">{t('nav.blog')}</Link>
                    <Link to="/tools">{t('nav.tools')}</Link>
                    <Link to="/terms">{t('footer.terms')}</Link>
                    <Link to="/privacy">{t('footer.privacy')}</Link>
                    <a href="https://x.com/zeroxwork" target="_blank" rel="noreferrer noopener">X / Twitter</a>
                </div>

                <div className="zx-foot-c">© {new Date().getFullYear()} ZEROxWORK · {t('footer.rights')}</div>
            </div>
        </footer>
    );
};

export default Footer;
