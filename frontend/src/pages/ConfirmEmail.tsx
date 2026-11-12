import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/axios-setup';
import { AUTH_ERROR_GENERIC, authErrorKey } from '../services/auth-error';
import { takeLinkToken } from '../services/link-token';
import { useTranslation } from '../i18n';

/** Where the link in the "confirm your new email" mail lands. */
const ConfirmEmail: React.FC = () => {
    const { t } = useTranslation();
    // Stored as a key, not a translated string: the effect must not depend on `t`,
    // or a re-render would fire a second POST with an already-consumed token.
    const [errorKey, setErrorKey] = useState('');
    const [confirmedEmail, setConfirmedEmail] = useState<string | null>(null);
    // The token is good for one use and StrictMode runs effects twice in
    // development: the second POST would come back TOKEN_INVALID and paint an
    // error over a change that went through.
    const started = useRef(false);

    useEffect(() => {
        if (started.current) return;
        started.current = true;

        // Not from the address: index.html has already taken the token out of it.
        const token = takeLinkToken('/confirm-email');

        if (!token) {
            setErrorKey('confirm_email.no_token');
            return;
        }

        api.post('/auth/confirm-email-change', { token })
            .then(({ data }) => setConfirmedEmail(String(data?.email ?? '')))
            .catch((error: unknown) => setErrorKey(authErrorKey(error) ?? AUTH_ERROR_GENERIC));
    }, []);

    return (
        <div className="uk-section uk-section-small">
            <div className="uk-container">
                <h2>{t('confirm_email.title')}</h2>
                {errorKey ? (
                    <>
                        <p className="uk-text-danger">{t(errorKey)}</p>
                        <Link to="/login">{t('confirm_email.login_link')}</Link>
                    </>
                ) : confirmedEmail !== null ? (
                    <>
                        {/* A function, so a `$` in the address is not read as a
                            replacement pattern. */}
                        <p className="uk-text-success">{t('confirm_email.done').replace('{email}', () => confirmedEmail)}</p>
                        {/* To the login form and not to /account: the link is
                            often opened in a browser that holds no session. */}
                        <Link to="/login">{t('confirm_email.login_link')}</Link>
                    </>
                ) : (
                    <p>{t('confirm_email.checking')}</p>
                )}
            </div>
        </div>
    );
};

export default ConfirmEmail;
