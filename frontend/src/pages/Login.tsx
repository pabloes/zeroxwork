import { useState } from 'react';
import UIkit from 'uikit';
import {useAuth} from "../context/AuthContext";
import {api} from "../services/axios-setup";
import {authErrorKey} from "../services/auth-error";
import {Link, useLocation} from "react-router-dom";
import {useTranslation} from "../i18n";

const Login: React.FC = () => {
    const { login } = useAuth();
    const { t } = useTranslation();
    const location = useLocation();
    const arrival = location.state as { verified?: boolean; passwordReset?: boolean } | null;
    // Set by VerifyEmail right after a successful verification.
    const justVerified = Boolean(arrival?.verified);
    // Set by ResetPassword once the new password is stored.
    const justReset = Boolean(arrival?.passwordReset);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState('');
    const [resendToken, setResendToken] = useState<string | null>(null);
    const [sendingVerification, setSendingVerification] = useState(false);

    const handleLoginSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setIsSubmitting(true);
        setResendToken(null);

        try {
            await login(email, password);
            window.location.href = '/';
        } catch (error: any) {
            if (error.response?.data?.resendToken) {
                setResendToken(error.response.data.resendToken);
            }
            // Our own line for the refusals that carry a code we know (and for
            // the rate limiter); otherwise what the server said. It no longer
            // tells a wrong password from an email it has never seen.
            const key = authErrorKey(error);
            const errorMessage = key ? t(key) : (error?.response?.data?.error || t('login.error_default'));
            setMessage(errorMessage);
            UIkit.notification({ message: errorMessage, status: 'danger' });
        } finally {
            setIsSubmitting(false);
        }
    };

    async function sendVerificationMailAgain(){
        if (!resendToken) return;
        setSendingVerification(true);
        try {
            await api.post('/auth/send-verification-mail', { resendToken });
            UIkit.notification({ message: t('login.verification_sent'), status: 'success' });
        } catch (error: any) {
            const key = authErrorKey(error);
            const msg = key ? t(key) : (error?.response?.data?.message || t('login.verification_failed'));
            UIkit.notification({ message: msg, status: 'danger' });
            // Bring the link back so the send can be retried; on success it
            // stays hidden on purpose.
            setSendingVerification(false);
        }
    }

    return (
        <div className="uk-section uk-section-small">
            <div className="uk-container">
                <form onSubmit={handleLoginSubmit} className="uk-form-stacked">
                    <h2>{t('login.title')}</h2>
                    {justVerified && <p className="uk-text-success">{t('login.verified_notice')}</p>}
                    {justReset && <p className="uk-text-success">{t('login.password_reset_notice')}</p>}
                    <div className="uk-margin">
                        <label className="uk-form-label" htmlFor="email">{t('login.email')}</label>
                        <input
                            id="email"
                            className="uk-input"
                            type="email"
                            autoComplete="username"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div className="uk-margin">
                        <label className="uk-form-label" htmlFor="password">{t('login.password')}</label>
                        <input
                            id="password"
                            className="uk-input"
                            type="password"
                            autoComplete="current-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        className={`uk-button uk-button-primary ${isSubmitting ? 'uk-disabled' : ''}`}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? t('login.submitting') : t('login.submit')}
                    </button>
                </form>
                {message && <p className="uk-text-danger">{message}</p>}
                {resendToken && !sendingVerification ? <a onClick={sendVerificationMailAgain} style={{cursor:'pointer'}}>{t('login.resend_verification')}</a> :null}
                <p className="uk-margin-top">
                    <Link to="/forgot-password">{t('login.forgot_link')}</Link>
                    &nbsp;|&nbsp;
                    <Link to="/register">{t('login.register_link')}</Link>
                </p>
            </div>
        </div>
    );
};

export default Login;
