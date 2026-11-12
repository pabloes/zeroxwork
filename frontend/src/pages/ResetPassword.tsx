import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/axios-setup';
import { AUTH_ERROR_GENERIC, authErrorCode, authErrorKey } from '../services/auth-error';
import { PASSWORD_MIN, withPasswordMin } from '../services/handle';
import { takeLinkToken } from '../services/link-token';
import { useTranslation } from '../i18n';

const ResetPassword: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    // Not from the address: index.html has already taken the token out of it.
    const [token] = useState(() => takeLinkToken('/reset-password'));
    const [password, setPassword] = useState('');
    const [passwordRepeat, setPasswordRepeat] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorKey, setErrorKey] = useState('');
    // The link itself was refused (used, unknown or expired): no password will
    // get through with it, so the form gives way to asking for another one.
    const [linkRefused, setLinkRefused] = useState(false);

    // Same checks as the sign-up form. While the second field is empty there
    // is nothing to warn about: it is still being typed.
    const passwordsDiffer = passwordRepeat !== '' && passwordRepeat !== password;
    const passwordShort = password !== '' && password.length < PASSWORD_MIN;
    const canSubmit = !passwordsDiffer && !passwordShort && !isSubmitting;

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (password.length < PASSWORD_MIN) {
            setErrorKey('register.password_short');
            return;
        }
        if (password !== passwordRepeat) {
            setErrorKey('register.password_mismatch');
            return;
        }
        setErrorKey('');
        setIsSubmitting(true);

        try {
            await api.post('/auth/reset-password', { token, password });
            // `replace`, so Back does not return to a form whose link is spent.
            navigate('/login', { replace: true, state: { passwordReset: true } });
        } catch (error) {
            const code = authErrorCode(error);
            setLinkRefused(code === 'TOKEN_INVALID' || code === 'TOKEN_EXPIRED');
            setErrorKey(authErrorKey(error) ?? AUTH_ERROR_GENERIC);
            setIsSubmitting(false);
        }
    };

    const requestLink = <Link to="/forgot-password">{t('reset.request_link')}</Link>;

    return (
        <div className="uk-section uk-section-small">
            <div className="uk-container">
                <h2>{t('reset.title')}</h2>
                {!token ? (
                    <>
                        <p className="uk-text-danger">{t('reset.no_token')}</p>
                        {requestLink}
                    </>
                ) : linkRefused ? (
                    <>
                        <p className="uk-text-danger">{t(errorKey)}</p>
                        {requestLink}
                    </>
                ) : (
                    <form onSubmit={handleSubmit} className="uk-form-stacked">
                        <div className="uk-margin">
                            <label className="uk-form-label" htmlFor="password">{t('reset.password')}</label>
                            <input
                                id="password"
                                className="uk-input"
                                type="password"
                                value={password}
                                autoComplete="new-password"
                                minLength={PASSWORD_MIN}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                            {passwordShort
                                ? <p className="uk-text-danger">{withPasswordMin(t('register.password_short'))}</p>
                                : <p className="uk-text-meta">{withPasswordMin(t('register.password_hint'))}</p>}
                        </div>
                        <div className="uk-margin">
                            <label className="uk-form-label" htmlFor="passwordRepeat">{t('reset.password_repeat')}</label>
                            <input
                                id="passwordRepeat"
                                className="uk-input"
                                type="password"
                                value={passwordRepeat}
                                autoComplete="new-password"
                                minLength={PASSWORD_MIN}
                                onChange={(e) => setPasswordRepeat(e.target.value)}
                                required
                            />
                            {passwordsDiffer && <p className="uk-text-danger">{t('register.password_mismatch')}</p>}
                        </div>
                        <button
                            type="submit"
                            className={`uk-button uk-button-primary ${canSubmit ? '' : 'uk-disabled'}`}
                            disabled={!canSubmit}
                        >
                            {isSubmitting ? t('reset.submitting') : t('reset.submit')}
                        </button>
                        {errorKey && <p className="uk-text-danger">{withPasswordMin(t(errorKey))}</p>}
                    </form>
                )}
            </div>
        </div>
    );
};

export default ResetPassword;
