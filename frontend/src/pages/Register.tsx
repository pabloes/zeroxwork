import { useState } from 'react';
import {AxiosError} from 'axios';
import UIkit from 'uikit';
import {api} from "../services/axios-setup";
import {useTranslation} from "../i18n";

const Register: React.FC = () => {
    const { t } = useTranslation();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isRegistered, setIsRegistered] = useState(false);
    const [message, setMessage] = useState('');
    const [acceptTerms, setAcceptTerms] = useState(false);
    const [acceptPrivacy, setAcceptPrivacy] = useState(false);
    const [acceptResponsibility, setAcceptResponsibility] = useState(false);

    const handleRegisterSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setIsSubmitting(true);

        try {
            await api.post('/auth/register', { email, password });
            setIsRegistered(true);
        } catch (axiosError:AxiosError|any) {
            const errorMessage = (typeof axiosError?.response?.data?.error === "string" ? axiosError?.response?.data?.error : axiosError?.response?.data?.error?.message) || t('register.error_default');
            setMessage(errorMessage);
            UIkit.notification({ message: errorMessage, status: 'danger' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="uk-section uk-section-small">
            <div className="uk-container">
                {!isRegistered ? (
                    <form onSubmit={handleRegisterSubmit} className="uk-form-stacked">
                        <h2>{t('register.title')}</h2>
                        <div className="uk-margin">
                            <label className="uk-form-label" htmlFor="email">{t('register.email')}</label>
                            <input
                                id="email"
                                className="uk-input"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <div className="uk-margin">
                            <label className="uk-form-label" htmlFor="password">{t('register.password')}</label>
                            <input
                                id="password"
                                className="uk-input"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                        <div className="uk-margin">
                            <label>
                                <input
                                    type="checkbox"
                                    className="uk-checkbox"
                                    checked={acceptTerms}
                                    onChange={() => setAcceptTerms(!acceptTerms)}
                                    required
                                />{' '}
                                {t('register.accept_terms')} <a href="/terms" target="_blank">{t('register.terms_link')}</a>.
                            </label>
                        </div>
                        <div className="uk-margin">
                            <label>
                                <input
                                    type="checkbox"
                                    className="uk-checkbox"
                                    checked={acceptPrivacy}
                                    onChange={() => setAcceptPrivacy(!acceptPrivacy)}
                                    required
                                />{' '}
                                {t('register.accept_privacy')} <a href="/privacy" target="_blank">{t('register.privacy_link')}</a>.
                            </label>
                        </div>
                        <div className="uk-margin">
                            <label>
                                <input
                                    type="checkbox"
                                    className="uk-checkbox"
                                    checked={acceptResponsibility}
                                    onChange={() => setAcceptResponsibility(!acceptResponsibility)}
                                    required
                                />{' '}
                                {t('register.accept_responsibility')}
                            </label>
                        </div>
                        <button
                            type="submit"
                            className={`uk-button uk-button-primary ${isSubmitting ? 'uk-disabled' : ''}`}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? t('register.submitting') : t('register.submit')}
                        </button>
                    </form>
                ) : (
                    <div className="uk-alert-success" uk-alert="true">
                        <p>{t('register.success')}</p>
                    </div>
                )}
                {message && <p>{message}</p>}
            </div>
        </div>
    );
};

export default Register;
