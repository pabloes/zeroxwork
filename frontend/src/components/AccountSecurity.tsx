import { useState } from 'react';
import UIkit from 'uikit';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/axios-setup';
import { AUTH_ERROR_GENERIC, authErrorKey } from '../services/auth-error';
import { PASSWORD_MIN, withPasswordMin } from '../services/handle';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../i18n';

/**
 * Password and sign-in email, changed from /account. Both ask for the current
 * password: a session left open on a shared computer must not be enough to
 * take the account.
 */
const AccountSecurity: React.FC = () => {
    const { t } = useTranslation();
    const { user, replaceToken } = useAuth();

    // Same query as ProfileForm, so it costs no request of its own. The token
    // also carries an email, but that one goes stale the moment it is changed.
    const { data: me } = useQuery<{ email?: string }>({
        queryKey: ['userInfo'],
        queryFn: async () => (await api.get('/user/me')).data,
    });
    const currentEmail: string = me?.email ?? user?.email ?? '';

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newPasswordRepeat, setNewPasswordRepeat] = useState('');
    const [passwordBusy, setPasswordBusy] = useState(false);
    // Errors are kept as i18n keys, so they follow a change of language.
    const [passwordError, setPasswordError] = useState('');
    const [passwordChanged, setPasswordChanged] = useState(false);

    const [newEmail, setNewEmail] = useState('');
    const [emailPassword, setEmailPassword] = useState('');
    const [emailBusy, setEmailBusy] = useState(false);
    const [emailError, setEmailError] = useState('');
    const [emailSentTo, setEmailSentTo] = useState<string | null>(null);

    // Same checks as the sign-up form. While the repeat is empty there is
    // nothing to warn about: it is still being typed.
    const passwordsDiffer = newPasswordRepeat !== '' && newPasswordRepeat !== newPassword;
    const passwordShort = newPassword !== '' && newPassword.length < PASSWORD_MIN;

    const changePassword = async (event: React.FormEvent) => {
        event.preventDefault();
        setPasswordChanged(false);
        if (newPassword.length < PASSWORD_MIN) {
            setPasswordError('register.password_short');
            return;
        }
        if (newPassword !== newPasswordRepeat) {
            setPasswordError('register.password_mismatch');
            return;
        }
        setPasswordError('');
        setPasswordBusy(true);

        try {
            const { data } = await api.post('/auth/change-password', { currentPassword, newPassword });
            // A new password signs every session out, this one included. The
            // server answers with a fresh token so this device stays in.
            if (typeof data?.token === 'string') replaceToken(data.token);
            setCurrentPassword('');
            setNewPassword('');
            setNewPasswordRepeat('');
            setPasswordChanged(true);
            UIkit.notification({ message: t('account.security.password_changed'), status: 'success' });
        } catch (error) {
            setPasswordError(authErrorKey(error) ?? AUTH_ERROR_GENERIC);
        } finally {
            setPasswordBusy(false);
        }
    };

    const changeEmail = async (event: React.FormEvent) => {
        event.preventDefault();
        setEmailError('');
        setEmailSentTo(null);
        setEmailBusy(true);

        const wanted = newEmail.trim();
        try {
            // Nothing changes yet: the new address has to prove it is theirs by
            // opening the link, and until then the current one keeps working.
            await api.post('/auth/change-email', { newEmail: wanted, currentPassword: emailPassword });
            setEmailSentTo(wanted);
            setNewEmail('');
            setEmailPassword('');
        } catch (error) {
            setEmailError(authErrorKey(error) ?? AUTH_ERROR_GENERIC);
        } finally {
            setEmailBusy(false);
        }
    };

    return (
        <section className="zx-panel">
            <h3 className="zx-panel-title">{t('account.security.title')}</h3>
            <p className="zx-panel-sub">{t('account.security.description')}</p>

            <div className="zx-security-forms">
                <form className="zx-security-form" onSubmit={changePassword}>
                    <h4 className="zx-security-form-title">{t('account.security.password_title')}</h4>

                    <label className="zx-label" htmlFor="zx-security-current-password">
                        {t('account.security.current_password')}
                    </label>
                    <input
                        id="zx-security-current-password"
                        className="zx-input"
                        type="password"
                        value={currentPassword}
                        autoComplete="current-password"
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        disabled={passwordBusy}
                        required
                    />

                    <label className="zx-label" htmlFor="zx-security-new-password">
                        {t('account.security.new_password')}
                    </label>
                    <input
                        id="zx-security-new-password"
                        className="zx-input"
                        type="password"
                        value={newPassword}
                        autoComplete="new-password"
                        minLength={PASSWORD_MIN}
                        onChange={(e) => setNewPassword(e.target.value)}
                        disabled={passwordBusy}
                        required
                    />
                    {passwordShort
                        ? <p className="zx-profile-error">{withPasswordMin(t('register.password_short'))}</p>
                        : <p className="zx-profile-hint">{withPasswordMin(t('register.password_hint'))}</p>}

                    <label className="zx-label" htmlFor="zx-security-new-password-repeat">
                        {t('account.security.new_password_repeat')}
                    </label>
                    <input
                        id="zx-security-new-password-repeat"
                        className="zx-input"
                        type="password"
                        value={newPasswordRepeat}
                        autoComplete="new-password"
                        minLength={PASSWORD_MIN}
                        onChange={(e) => setNewPasswordRepeat(e.target.value)}
                        disabled={passwordBusy}
                        required
                    />
                    {passwordsDiffer && <p className="zx-profile-error">{t('register.password_mismatch')}</p>}

                    <div className="zx-profile-actions">
                        <button
                            type="submit"
                            className="zx-btn zx-btn-primary"
                            disabled={passwordBusy || passwordsDiffer || passwordShort}
                        >
                            {passwordBusy ? t('account.saving') : t('account.security.password_submit')}
                        </button>
                    </div>

                    {passwordError && <p className="zx-profile-error">{withPasswordMin(t(passwordError))}</p>}
                    {passwordChanged && <p className="zx-panel-status">{t('account.security.password_changed')}</p>}
                </form>

                <form className="zx-security-form" onSubmit={changeEmail}>
                    <h4 className="zx-security-form-title">{t('account.security.email_title')}</h4>

                    {currentEmail && (
                        <p className="zx-profile-hint">
                            {t('account.security.current_email')} <strong>{currentEmail}</strong>
                        </p>
                    )}

                    <label className="zx-label" htmlFor="zx-security-new-email">
                        {t('account.security.new_email')}
                    </label>
                    <input
                        id="zx-security-new-email"
                        className="zx-input"
                        type="email"
                        value={newEmail}
                        autoComplete="email"
                        onChange={(e) => setNewEmail(e.target.value)}
                        disabled={emailBusy}
                        required
                    />

                    <label className="zx-label" htmlFor="zx-security-email-password">
                        {t('account.security.current_password')}
                    </label>
                    <input
                        id="zx-security-email-password"
                        className="zx-input"
                        type="password"
                        value={emailPassword}
                        autoComplete="current-password"
                        onChange={(e) => setEmailPassword(e.target.value)}
                        disabled={emailBusy}
                        required
                    />

                    <div className="zx-profile-actions">
                        <button type="submit" className="zx-btn zx-btn-primary" disabled={emailBusy}>
                            {emailBusy ? t('account.security.email_submitting') : t('account.security.email_submit')}
                        </button>
                    </div>

                    {emailError && <p className="zx-profile-error">{t(emailError)}</p>}
                    {emailSentTo !== null && (
                        <p className="zx-panel-status">
                            {/* A function, so a `$` in the address is not read as
                                a replacement pattern. */}
                            {t('account.security.email_sent').replace('{email}', () => emailSentTo)}
                        </p>
                    )}
                </form>
            </div>
        </section>
    );
};

export default AccountSecurity;
