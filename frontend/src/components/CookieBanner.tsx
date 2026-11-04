import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from "../i18n";

declare global {
    interface Window {
        // defined in index.html: stores consent and loads Analytics/AdSense
        zxAcceptCookies?: () => void;
    }
}

function alreadyAccepted(): boolean {
    try {
        return !!localStorage.getItem('cookiesAccepted');
    } catch {
        // storage blocked: show the notice, nothing is loaded until it is accepted
        return false;
    }
}

const CookieBanner: React.FC = () => {
    const { t } = useTranslation();
    const [accepted, setAccepted] = useState(alreadyAccepted);

    if (accepted) return null;

    const accept = () => {
        window.zxAcceptCookies?.();
        setAccepted(true);
    };

    return (
        <div className="zx-cookie" role="region" aria-label={t('cookies.title')}>
            <div className="zx-cookie-box">
                <p>{t('cookies.text')}</p>
                <div className="zx-cookie-actions">
                    <Link to="/privacy">{t('cookies.link')}</Link>
                    <button type="button" className="zx-btn zx-btn-primary" onClick={accept}>
                        {t('cookies.accept')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CookieBanner;
