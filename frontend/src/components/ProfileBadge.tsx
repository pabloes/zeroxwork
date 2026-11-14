import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/axios-setup';
import { useTranslation } from '../i18n';

/** How much bigger than its own units the downloaded PNG is drawn. */
const PNG_SCALE = 3;

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
 * everywhere they pasted it, without touching any of those places. The two
 * downloads are for the places that will not take a URL.
 */
const ProfileBadge: React.FC<{ changes?: number }> = ({ changes = 0 }) => {
    const { t } = useTranslation();

    const { data: me } = useQuery<Me>({
        queryKey: ['userInfo'],
        queryFn: async () => (await api.get('/user/me')).data,
    });

    const [copied, setCopied] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!me) return null;

    // The saved handle, not the one being typed next door: the badge is a file
    // other sites already hold, and it only moves when the profile is saved.
    const name = me.handle || String(me.id);
    const url = `${window.location.origin}/api/badge/${name}.svg`;
    // The preview has to show the save that just happened, and a browser that
    // has the old badge in hand would not go and ask again.
    const preview = `${url}?v=${changes}`;

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

    const downloadSvg = async () => {
        setError(null);
        setBusy(true);
        try {
            const response = await fetch(preview);
            if (!response.ok) throw new Error(String(response.status));
            save(await response.blob(), 'svg');
        } catch {
            setError(t('account.badge.download_error'));
        } finally {
            setBusy(false);
        }
    };

    /**
     * The PNG is drawn here rather than asked of the server: the badge is text
     * on a card, and the fonts live in this browser, not on ours.
     */
    const downloadPng = async () => {
        setError(null);
        setBusy(true);
        let objectUrl: string | null = null;
        try {
            const response = await fetch(preview);
            if (!response.ok) throw new Error(String(response.status));
            const svg = await response.text();

            objectUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
            const image = await new Promise<HTMLImageElement>((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => reject(new Error('decode'));
                img.src = objectUrl as string;
            });

            const canvas = document.createElement('canvas');
            canvas.width = (image.naturalWidth || 440) * PNG_SCALE;
            canvas.height = (image.naturalHeight || 120) * PNG_SCALE;
            const context = canvas.getContext('2d');
            if (!context) throw new Error('canvas');
            context.drawImage(image, 0, 0, canvas.width, canvas.height);

            const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
            if (!blob) throw new Error('blob');
            save(blob, 'png');
        } catch {
            setError(t('account.badge.download_error'));
        } finally {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
            setBusy(false);
        }
    };

    return (
        <section className="zx-profile zx-badge">
            <h3 className="zx-profile-title">{t('account.badge.title')}</h3>
            <p className="zx-profile-hint">{t('account.badge.hint')}</p>

            <div className="zx-badge-preview">
                <img src={preview} alt={t('account.badge.alt')} />
            </div>

            <label className="zx-label" htmlFor="zx-badge-url">{t('account.badge.url_label')}</label>
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

            <div className="zx-profile-actions">
                <button type="button" className="zx-btn zx-btn-ghost" onClick={downloadPng} disabled={busy}>
                    {busy ? t('account.badge.preparing') : t('account.badge.download_png')}
                </button>
                <button type="button" className="zx-btn zx-btn-ghost" onClick={downloadSvg} disabled={busy}>
                    {t('account.badge.download_svg')}
                </button>
            </div>

            {error && <p className="zx-profile-error">{error}</p>}
        </section>
    );
};

export default ProfileBadge;
