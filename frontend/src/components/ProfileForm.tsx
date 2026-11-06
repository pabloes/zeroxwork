import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/axios-setup';
import { getNameAvatarImage } from '../services/get-name-avatar-image';
import { useTranslation } from '../i18n';

const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // same ceiling as the upload service
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const DISPLAY_NAME_MAX = 40;

interface Me {
    id: number;
    displayName: string | null;
    avatarUrl: string | null;
    defaultName: { id: number; name: string; walletAddress: string } | null;
}

/**
 * Public profile: display name + avatar, both optional.
 * The avatar goes through the normal image upload service (virus/content scan,
 * quota, banned flag); we only store the URL it gives back.
 */
const ProfileForm: React.FC<{ onSaved?: () => void }> = ({ onSaved }) => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();

    const { data: me, isLoading } = useQuery<Me>({
        queryKey: ['userInfo'],
        queryFn: async () => (await api.get('/user/me')).data,
    });

    const [displayName, setDisplayName] = useState('');
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (!me) return;
        setDisplayName(me.displayName ?? '');
        setAvatarUrl(me.avatarUrl ?? null);
    }, [me]);

    const preview = getNameAvatarImage({
        name: me?.defaultName?.name,
        address: me?.defaultName?.walletAddress,
        avatarUrl,
        seed: me?.id,
    });

    const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = ''; // let the same file be picked again after an error
        if (!file) return;

        setError(null);
        setSaved(false);

        if (!ALLOWED_TYPES.includes(file.type)) {
            setError(t('account.avatar_type'));
            return;
        }
        if (file.size > MAX_AVATAR_BYTES) {
            setError(t('account.avatar_too_big'));
            return;
        }

        // Respect the account quota before spending an upload on it.
        try {
            const quota = (await api.get('/user/quota')).data;
            const available = (quota.maxQuota + quota.extraQuota) - quota.usedQuota;
            if (file.size > available) {
                setError(t('account.avatar_quota'));
                return;
            }
        } catch {
            // If the quota cannot be read we let the upload service decide.
        }

        const formData = new FormData();
        formData.append('image', file);

        setUploading(true);
        try {
            const { data } = await api.post('/images/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            if (data.banned) {
                setError(t('account.avatar_rejected'));
                return;
            }
            setAvatarUrl(data.servedUrl ?? `/api/images/user-uploaded-images/${data.fileName}`);
        } catch (err: any) {
            setError(err?.response?.data?.message || t('account.upload_error'));
        } finally {
            setUploading(false);
        }
    };

    const handleSave = async () => {
        setError(null);
        setSaved(false);
        setSaving(true);
        try {
            await api.put('/user/profile', {
                displayName: displayName.trim(),
                avatarUrl,
            });
            await queryClient.invalidateQueries({ queryKey: ['userInfo'] });
            setSaved(true);
            onSaved?.();
        } catch (err: any) {
            setError(err?.response?.data?.message || t('account.save_error'));
        } finally {
            setSaving(false);
        }
    };

    if (isLoading) {
        return <p className="zx-profile-hint">{t('common.loading')}</p>;
    }

    return (
        <section className="zx-profile">
            <h3 className="zx-profile-title">{t('account.profile_title')}</h3>
            <p className="zx-profile-hint">{t('account.profile_hint')}</p>

            <div className="zx-profile-grid">
                <div className="zx-profile-avatar">
                    <img src={preview} alt="" width={96} height={96} />
                    <label className="zx-btn zx-btn-ghost zx-profile-file">
                        {uploading ? t('account.avatar_uploading') : t('account.avatar_choose')}
                        <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={handleFile}
                            disabled={uploading || saving}
                        />
                    </label>
                    {avatarUrl && (
                        <button
                            type="button"
                            className="zx-profile-remove"
                            onClick={() => { setAvatarUrl(null); setSaved(false); }}
                            disabled={uploading || saving}
                        >
                            {t('account.avatar_remove')}
                        </button>
                    )}
                </div>

                <div className="zx-profile-fields">
                    <label className="zx-label" htmlFor="zx-display-name">{t('account.display_name')}</label>
                    <input
                        id="zx-display-name"
                        className="zx-input"
                        type="text"
                        value={displayName}
                        maxLength={DISPLAY_NAME_MAX}
                        placeholder={t('account.display_name_placeholder')}
                        onChange={(e) => { setDisplayName(e.target.value); setSaved(false); }}
                        disabled={saving}
                    />
                    <p className="zx-profile-hint">{t('account.display_name_hint')}</p>
                    <p className="zx-profile-hint">{t('account.avatar_hint')}</p>

                    <div className="zx-profile-actions">
                        <button
                            type="button"
                            className="zx-btn zx-btn-primary"
                            onClick={handleSave}
                            disabled={saving || uploading}
                        >
                            {saving ? t('account.saving') : t('account.save')}
                        </button>
                        {saved && <span className="zx-profile-ok">{t('account.saved')}</span>}
                    </div>

                    {error && <p className="zx-profile-error">{error}</p>}
                </div>
            </div>
        </section>
    );
};

export default ProfileForm;
