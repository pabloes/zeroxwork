import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/axios-setup';
import { useTranslation } from '../i18n';

/** The two shapes the badge comes in, and what each is for. */
type Format = 'svg' | 'png';

/** The downloaded PNG is drawn at twice the card, so it survives a zoom. */
const DOWNLOAD_SCALE = 2;

interface Me {
    id: number;
    handle: string | null;
}

/**
 * The badge: the member's card as one picture, for anywhere that is not this
 * site -- a README, a forum signature, their own page.
 *
 * The address is the badge. It is served from /api/badge and drawn from what
 * the profile says right now, so a member who changes their avatar changes it
 * everywhere they pasted it, without touching any of those places. SVG is the
 * better file; PNG is there because plenty of places will not take an SVG.
 */
const ProfileBadge: React.FC<{ changes?: number }> = ({ changes = 0 }) => {
    const { t } = useTranslation();

    const { data: me } = useQuery<Me>({
        queryKey: ['userInfo'],
        queryFn: async () => (await api.get('/user/me')).data,
    });

    const [format, setFormat] = useState<Format>('svg');
    const [copied, setCopied] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // The block stays on the page while the profile is on its way: a panel that
    // simply is not there reads as a feature that is not there.
    if (!me) {
        return (
            <section className="zx-panel zx-badge">
                <h3 className="zx-panel-title">{t('account.badge.title')}</h3>
                <p className="zx-profile-hint">{t('common.loading')}</p>
            </section>
        );
    }

    // The saved handle, not the one being typed next door: the badge is a file
    // other sites already hold, and it only moves when the profile is saved.
    const name = me.handle || String(me.id);
    const address = `${window.location.origin}/api/badge/${name}`;
    const url = `${address}.${format}`;
    // The preview has to show the save that just happened, and a browser that
    // has the old badge in hand would not go and ask again.
    const preview = `${address}.svg?v=${changes}`;

    const pick = (next: Format) => {
        setFormat(next);
        setCopied(false);
        setError(null);
    };

    /** Tabbing here selects the address but copies nothing: that needs a click. */
    const selectAll = (event: React.FocusEvent<HTMLInputElement>) => event.currentTarget.select();

    const copy = async (event: React.MouseEvent<HTMLInputElement>) => {
        event.currentTarget.select();
        setError(null);
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2500);
        } catch {
            // Clipboard refused (an old browser, or no permission): the text is
            // selected anyway, so it is one keystroke away.
            setError(t('account.badge.copy_failed'));
        }
    };

    /** Hands the browser a file without ever leaving the page. */
    const save = (blob: Blob, extension: string) => {
        const href = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = href;
        link.download = `zeroxwork-${name}.${extension}`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(href);
    };

    /**
     * Both files come from the same address the badge lives at, so what gets
     * downloaded is exactly what everyone else is served.
     */
    const download = async (extension: Format) => {
        setError(null);
        setBusy(true);
        try {
            const from = extension === 'png'
                ? `${address}.png?scale=${DOWNLOAD_SCALE}&v=${changes}`
                : `${address}.svg?v=${changes}`;
            const response = await fetch(from);
            if (!response.ok) throw new Error(String(response.status));
            save(await response.blob(), extension);
        } catch {
            setError(t('account.badge.download_error'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className="zx-panel zx-badge">
            <h3 className="zx-panel-title">{t('account.badge.title')}</h3>
            <p className="zx-panel-sub">{t('account.badge.hint')}</p>

            <div className="zx-badge-preview">
                <img src={preview} alt={t('account.badge.alt')} />
            </div>

            <div className="zx-badge-head">
                <label className="zx-label" htmlFor="zx-badge-url">{t('account.badge.url_label')}</label>
                <div className="zx-badge-switch" role="group" aria-label={t('account.badge.url_label')}>
                    {(['svg', 'png'] as Format[]).map((option) => (
                        <button
                            key={option}
                            type="button"
                            className={option === format ? 'is-on' : ''}
                            aria-pressed={option === format}
                            onClick={() => pick(option)}
                        >
                            {option.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            <input
                id="zx-badge-url"
                className="zx-input zx-badge-url"
                type="text"
                readOnly
                value={url}
                onClick={copy}
                onFocus={selectAll}
                title={t('account.badge.url_hint')}
            />
            <p className="zx-profile-hint">
                {t('account.badge.url_hint')}
                {copied && <span className="zx-profile-ok"> {t('account.badge.copied')}</span>}
            </p>
            <p className="zx-profile-hint">{t('account.badge.format_hint')}</p>

            <div className="zx-profile-actions">
                <button type="button" className="zx-btn zx-btn-ghost" onClick={() => download('png')} disabled={busy}>
                    {busy ? t('account.badge.preparing') : t('account.badge.download_png')}
                </button>
                <button type="button" className="zx-btn zx-btn-ghost" onClick={() => download('svg')} disabled={busy}>
                    {t('account.badge.download_svg')}
                </button>
            </div>

            {error && <p className="zx-profile-error">{error}</p>}
        </section>
    );
};

export default ProfileBadge;
