import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from "../i18n";
import ZxMark from "./ZxMark";
import DiscordIcon from "./DiscordIcon";
import { DISCORD_INVITE_URL, X_PROFILE_URL } from "../constants/links";

const Footer: React.FC = () => {
    const { t } = useTranslation();

    return (
        <footer className="zx-footer">
            <div className="zx-wrap zx-foot-in">
                <Link to="/" className="zx-brand" aria-label="ZEROxWORK">
                    <ZxMark />
                    <span className="zx-wordmark"><span className="z">ZEROx</span>WORK</span>
                </Link>

                <div className="zx-foot-links">
                    <Link to="/blog">{t('nav.blog')}</Link>
                    <Link to="/portfolio">{t('nav.portfolio')}</Link>
                    <Link to="/members">{t('nav.members')}</Link>
                    <Link to="/terms">{t('footer.terms')}</Link>
                    <Link to="/privacy">{t('footer.privacy')}</Link>
                    <a href={X_PROFILE_URL} target="_blank" rel="noreferrer noopener">X / Twitter</a>
                    <a
                        className="zx-foot-social"
                        href={DISCORD_INVITE_URL}
                        target="_blank"
                        rel="noreferrer noopener"
                    >
                        <DiscordIcon size={15} />
                        Discord
                    </a>
                </div>

                <div className="zx-foot-c">© {new Date().getFullYear()} ZEROxWORK · {t('footer.rights')}</div>
            </div>
        </footer>
    );
};

export default Footer;
