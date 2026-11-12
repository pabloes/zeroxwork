import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/axios-setup';
import { AUTH_ERROR_GENERIC, authErrorKey } from '../services/auth-error';
import { useTranslation } from '../i18n';

const ForgotPassword: React.FC = () => {
    const { t } = useTranslation();
    const [email, setEmail] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [sent, setSent] = useState(false);
    const [errorKey, setErrorKey] = useState('');

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setErrorKey('');
        setIsSubmitting(true);

        try {
            // The answer is the same whether or not the address has an account,
            // and so is what we show: this form must not tell who is registered.
            await api.post('/auth/forgot-password', { email });
            setSent(true);
        } catch (error) {
            setErrorKey(authErrorKey(error) ?? AUTH_ERROR_GENERIC);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="uk-section uk-section-small">
            <div className="uk-container">
                <h2>{t('forgot.title')}</h2>
                {sent ? (
                    <>
                        <p>{t('forgot.sent')}</p>
                        <Link to="/login">{t('forgot.login_link')}</Link>
                    </>
                ) : (
                    <>
                        <form onSubmit={handleSubmit} className="uk-form-stacked">
                            <p className="uk-text-meta">{t('forgot.intro')}</p>
                            <div className="uk-margin">
                                <label className="uk-form-label" htmlFor="email">{t('forgot.email')}</label>
                                <input
                                    id="email"
                                    className="uk-input"
                                    type="email"
                                    autoComplete="username"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                                {errorKey && <p className="uk-text-danger">{t(errorKey)}</p>}
                            </div>
                            <button
                                type="submit"
                                className={`uk-button uk-button-primary ${isSubmitting ? 'uk-disabled' : ''}`}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? t('forgot.submitting') : t('forgot.submit')}
                            </button>
                        </form>
                        <p className="uk-margin-top">
                            <Link to="/login">{t('forgot.login_link')}</Link>
                        </p>
                    </>
                )}
            </div>
        </div>
    );
};

export default ForgotPassword;
