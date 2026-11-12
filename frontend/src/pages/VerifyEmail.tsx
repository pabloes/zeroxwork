import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/axios-setup';
import { takeLinkToken } from '../services/link-token';
import { useTranslation } from '../i18n';

const VerifyEmail = () => {
    const { t } = useTranslation();
    // Stored as a key, not a translated string: the effect must not depend on `t`,
    // or a re-render would fire a second POST with an already-consumed token.
    const [errorKey, setErrorKey] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        // Not from the address: index.html has already taken the token out of it.
        const token = takeLinkToken('/verify');

        if (!token) {
            setErrorKey('verify.no_token');
            return;
        }

        // Straight to the login form: the account is ready and signing in is
        // the only thing left to do. `replace` keeps the spent token out of
        // the history, so Back cannot re-trigger the verification.
        const toLogin = () => navigate('/login', { replace: true, state: { verified: true } });

        api.post('/auth/verify', { token })
            .then(toLogin)
            .catch((axiosError: any) => {
                // Opening the link twice is not a failure: the account is verified.
                if (axiosError?.response?.data?.message === 'User is already verified.') {
                    toLogin();
                    return;
                }
                setErrorKey('verify.failed');
            });
    }, [navigate]);

    return (
        <div className="uk-section uk-section-small">
            <div className="uk-container">
                <h2>{t('verify.title')}</h2>
                {errorKey ? (
                    <>
                        <p className="uk-text-danger">{t(errorKey)}</p>
                        <Link to="/login">{t('verify.login_link')}</Link>
                    </>
                ) : (
                    <p>{t('verify.checking')}</p>
                )}
            </div>
        </div>
    );
};

export default VerifyEmail;
