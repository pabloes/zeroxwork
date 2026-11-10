import { useEffect, useRef, useState } from 'react';
import {AxiosError} from 'axios';
import UIkit from 'uikit';
import {api} from "../services/axios-setup";
import {useTranslation} from "../i18n";
import SocialLinksFields from "../components/SocialLinksFields";
import { getNameAvatarImage } from "../services/get-name-avatar-image";
import {
    DISPLAY_NAME_MAX,
    HANDLE_MAX,
    checkHandle,
    fileToAvatarDataUrl,
    handleShapeError,
    slugifyHandle,
} from "../services/handle";

/** How long after the last keystroke the address is checked against the server. */
const CHECK_DEBOUNCE_MS = 450;

type CheckState =
    | { status: 'idle' }
    | { status: 'checking' }
    | { status: 'free' }
    | { status: 'taken'; suggestion: string | null }
    | { status: 'bad'; code: string };

const Register: React.FC = () => {
    const { t } = useTranslation();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [passwordRepeat, setPasswordRepeat] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isRegistered, setIsRegistered] = useState(false);
    const [message, setMessage] = useState('');
    const [acceptTerms, setAcceptTerms] = useState(false);
    const [acceptPrivacy, setAcceptPrivacy] = useState(false);
    const [acceptResponsibility, setAcceptResponsibility] = useState(false);
    const [socials, setSocials] = useState<Record<string, string>>({});

    // Public profile, asked for here rather than left to /account.
    const [displayName, setDisplayName] = useState('');
    const [handle, setHandle] = useState('');
    // Once they edit the address by hand it stops following the name, and a
    // taken one is theirs to fix: we offer a suggestion instead of applying it.
    const [handleEdited, setHandleEdited] = useState(false);
    const [check, setCheck] = useState<CheckState>({ status: 'idle' });
    const [avatar, setAvatar] = useState<string | null>(null);
    const [avatarError, setAvatarError] = useState<string | null>(null);
    const [registeredHandle, setRegisteredHandle] = useState('');
    const [avatarDropped, setAvatarDropped] = useState(false);

    // The address writes itself from the name until they touch it.
    useEffect(() => {
        if (handleEdited) return;
        setHandle(slugifyHandle(displayName));
    }, [displayName, handleEdited]);

    // Ask the server whether the address is free, once the typing stops. The
    // answer is a snapshot and the registration checks again before writing.
    const checkSeq = useRef(0);
    useEffect(() => {
        const wanted = handle.trim().toLowerCase();
        if (wanted === '') {
            setCheck({ status: 'idle' });
            return;
        }

        const shape = handleShapeError(wanted);
        if (shape) {
            setCheck({ status: 'bad', code: shape });
            return;
        }

        setCheck({ status: 'checking' });
        const seq = ++checkSeq.current;
        const timer = window.setTimeout(async () => {
            try {
                const result = await checkHandle(wanted);
                if (seq !== checkSeq.current) return; // a newer keystroke won
                if (result.available) {
                    setCheck({ status: 'free' });
                } else if (result.code === 'HANDLE_TAKEN') {
                    // Taken, and they never typed this address themselves: it
                    // came from their name, so move it along to the free one
                    // rather than stopping them over a name they share.
                    if (!handleEdited && result.suggestion && result.suggestion !== wanted) {
                        setHandle(result.suggestion);
                        return;
                    }
                    setCheck({ status: 'taken', suggestion: result.suggestion });
                } else {
                    setCheck({ status: 'bad', code: result.code ?? 'HANDLE_INVALID' });
                }
            } catch {
                if (seq !== checkSeq.current) return;
                // The check is a courtesy; the server has the last word anyway.
                setCheck({ status: 'idle' });
            }
        }, CHECK_DEBOUNCE_MS);

        return () => window.clearTimeout(timer);
    }, [handle, handleEdited]);

    const pickAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = ''; // let the same file be picked again after an error
        if (!file) return;

        setAvatarError(null);
        try {
            setAvatar(await fileToAvatarDataUrl(file));
        } catch (error: any) {
            setAvatarError(error?.message === 'AVATAR_TYPE' ? t('register.avatar_type') : t('register.avatar_error'));
        }
    };

    const typedHandle = handle.trim().toLowerCase();
    const nameOk = displayName.trim().length >= 2;
    const handleOk = typedHandle !== '' && (check.status === 'free' || check.status === 'checking');
    // Mientras el segundo campo esta vacio no hay nada que avisar: lo estan
    // escribiendo. Que falte lo caza el `required` del navegador.
    const passwordsDiffer = passwordRepeat !== '' && passwordRepeat !== password;
    const canSubmit = nameOk && handleOk && !passwordsDiffer && !isSubmitting;

    const handleRegisterSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (password !== passwordRepeat) {
            setMessage(t('register.password_mismatch'));
            return;
        }
        setIsSubmitting(true);

        try {
            // Networks left blank are dropped: an added-but-empty field is not an answer.
            const filledSocials = Object.fromEntries(
                Object.entries(socials).filter(([, handle]) => handle.trim())
            );
            const { data } = await api.post('/auth/register', {
                email,
                password,
                socials: filledSocials,
                displayName: displayName.trim(),
                handle: typedHandle,
                ...(avatar ? { avatar } : {}),
            });
            // The stored address is not always the one asked for: somebody can
            // claim it between the check and the insert.
            setRegisteredHandle(data?.handle || typedHandle);
            setAvatarDropped(Boolean(avatar) && data?.avatarStored === false);
            setIsRegistered(true);
        } catch (axiosError:AxiosError|any) {
            const errorMessage = (typeof axiosError?.response?.data?.error === "string" ? axiosError?.response?.data?.error : axiosError?.response?.data?.error?.message) || t('register.error_default');
            setMessage(errorMessage);
            UIkit.notification({ message: errorMessage, status: 'danger' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const avatarPreview = getNameAvatarImage({
        avatarUrl: avatar,
        name: displayName || undefined,
        seed: typedHandle || displayName || email || 'zeroxwork',
    });

    return (
        <div className="uk-section uk-section-small">
            <div className="uk-container">
                {!isRegistered ? (
                    <form onSubmit={handleRegisterSubmit} className="uk-form-stacked">
                        <h2>{t('register.title')}</h2>
                        <p className="uk-text-meta">{t('register.profile_hint')}</p>

                        <div className="uk-margin zx-profile-avatar">
                            <img src={avatarPreview} alt="" width={96} height={96} />
                            <label className="zx-btn zx-btn-ghost zx-profile-file">
                                {t('register.avatar_choose')}
                                <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    onChange={pickAvatar}
                                    disabled={isSubmitting}
                                />
                            </label>
                            {avatar && (
                                <button
                                    type="button"
                                    className="zx-profile-remove"
                                    onClick={() => setAvatar(null)}
                                    disabled={isSubmitting}
                                >
                                    {t('register.avatar_remove')}
                                </button>
                            )}
                            <p className="uk-text-meta">{t('register.avatar_hint')}</p>
                            {avatarError && <p className="uk-text-danger">{avatarError}</p>}
                        </div>

                        <div className="uk-margin">
                            <label className="uk-form-label" htmlFor="displayName">{t('register.display_name')}</label>
                            <input
                                id="displayName"
                                className="uk-input"
                                type="text"
                                value={displayName}
                                maxLength={DISPLAY_NAME_MAX}
                                placeholder={t('register.display_name_placeholder')}
                                onChange={(e) => setDisplayName(e.target.value)}
                                required
                            />
                            <p className="uk-text-meta">{t('register.display_name_hint')}</p>
                        </div>

                        <div className="uk-margin">
                            <label className="uk-form-label" htmlFor="handle">{t('register.handle')}</label>
                            <input
                                id="handle"
                                className="uk-input"
                                type="text"
                                value={handle}
                                maxLength={HANDLE_MAX}
                                placeholder="carlosmu"
                                autoCapitalize="none"
                                spellCheck={false}
                                onChange={(e) => { setHandleEdited(true); setHandle(e.target.value); }}
                                required
                            />
                            {/* The address itself, spelled out whole, because that
                                is what the field actually decides. */}
                            <p className="uk-text-meta">
                                {`${window.location.host}/member/${typedHandle || '…'}`}
                            </p>
                            {check.status === 'checking' && <p className="uk-text-meta">{t('register.handle_checking')}</p>}
                            {check.status === 'free' && <p className="uk-text-success">{t('register.handle_free')}</p>}
                            {check.status === 'bad' && (
                                <p className="uk-text-danger">
                                    {check.code === 'HANDLE_RESERVED' ? t('register.handle_reserved')
                                        : check.code === 'HANDLE_LENGTH' ? t('register.handle_length')
                                        : t('register.handle_invalid')}
                                </p>
                            )}
                            {check.status === 'taken' && (
                                <p className="uk-text-danger">
                                    {t('register.handle_taken')}
                                    {check.suggestion && (
                                        <>
                                            {' '}
                                            <button
                                                type="button"
                                                className="uk-button uk-button-link"
                                                onClick={() => setHandle(check.suggestion as string)}
                                            >
                                                {t('register.handle_use')} {check.suggestion}
                                            </button>
                                        </>
                                    )}
                                </p>
                            )}
                            <p className="uk-text-meta">{t('register.handle_hint')}</p>
                        </div>

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
                                autoComplete="new-password"
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                        {/* Se escribe dos veces porque no se ve lo que se teclea
                            y un dedo torcido deja fuera de su propia cuenta a
                            quien se acaba de registrar. */}
                        <div className="uk-margin">
                            <label className="uk-form-label" htmlFor="passwordRepeat">{t('register.password_repeat')}</label>
                            <input
                                id="passwordRepeat"
                                className="uk-input"
                                type="password"
                                value={passwordRepeat}
                                autoComplete="new-password"
                                onChange={(e) => setPasswordRepeat(e.target.value)}
                                required
                            />
                            {passwordsDiffer && <p className="uk-text-danger">{t('register.password_mismatch')}</p>}
                        </div>
                        <SocialLinksFields value={socials} onChange={setSocials} />
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
                            className={`uk-button uk-button-primary ${canSubmit ? '' : 'uk-disabled'}`}
                            disabled={!canSubmit}
                        >
                            {isSubmitting ? t('register.submitting') : t('register.submit')}
                        </button>
                    </form>
                ) : (
                    <div className="uk-alert-success" uk-alert="true">
                        <p>{t('register.success')}</p>
                        <p>{t('register.success_url')} <strong>{`${window.location.host}/member/${registeredHandle}`}</strong></p>
                        {avatarDropped && <p>{t('register.avatar_dropped')}</p>}
                    </div>
                )}
                {message && <p>{message}</p>}
            </div>
        </div>
    );
};

export default Register;
