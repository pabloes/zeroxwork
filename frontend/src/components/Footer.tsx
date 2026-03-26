import React from 'react';
import {useTranslation} from "../i18n";

const Footer: React.FC = () => {
    const { t } = useTranslation();

    return (
        <footer className="uk-background-secondary uk-light uk-padding">
            <div className="uk-container uk-text-center">
                <div>
                    <span className="uk-align-left">
                    {t('footer.follow_us')} <a href="https://x.com/zeroxwork" className="uk-icon-button uk-margin-small-right" uk-icon="twitter" target="_blank" rel="noreferrer noopener"></a>
                    </span>
                    <span className="uk-align-right">&copy; 2025 ZEROxWORK. {t('footer.rights')} | <a href="/terms">{t('footer.terms')}</a> | <a href="/privacy">{t('footer.privacy')}</a></span>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
