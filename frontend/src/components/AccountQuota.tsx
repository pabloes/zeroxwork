import React, { useEffect, useState } from 'react';
import { formatFileSize } from '../services/format-file-size';
import { api } from '../services/axios-setup';
import { useTranslation } from '../i18n';

interface QuotaProps {
    /** Bytes about to be uploaded, so the bar can show what they would cost. */
    add?: number;
    /** Bumped by whoever changed something that moves the quota. */
    changes?: number;
}

/**
 * How much of the image quota is gone. Shown on the account page, and again on
 * the upload page with `add` set, where it answers the only question that
 * matters there: does this file still fit.
 */
const AccountQuota: React.FC<QuotaProps> = ({ add = 0, changes = 0 }) => {
    const { t } = useTranslation();
    const [used, setUsed] = useState(0);
    const [max, setMax] = useState(0);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let gone = false;

        (async () => {
            try {
                const { data } = await api.get('/user/quota');
                if (gone) return;
                setUsed(data.usedQuota);
                setMax(data.maxQuota + data.extraQuota);
                setFailed(false);
            } catch {
                if (!gone) setFailed(true);
            } finally {
                if (!gone) setLoading(false);
            }
        })();

        return () => { gone = true; };
    }, [changes]);

    if (loading) {
        return (
            <section className="zx-panel">
                <h3 className="zx-panel-title">{t('account.quota.title')}</h3>
                <p className="zx-profile-hint">{t('account.quota.loading')}</p>
            </section>
        );
    }

    if (failed) {
        return (
            <section className="zx-panel">
                <h3 className="zx-panel-title">{t('account.quota.title')}</h3>
                <p className="zx-profile-error">{t('account.quota.error')}</p>
            </section>
        );
    }

    const taken = used + add;
    const over = taken > max;
    // A quota of zero would otherwise read as NaN%, and nothing fits in it
    // anyway, so it is full by definition.
    const percent = max > 0 ? Math.min(Math.round((taken / max) * 100), 999) : 100;

    return (
        <section className="zx-panel">
            <h3 className="zx-panel-title">{t('account.quota.title')}</h3>
            <p className="zx-panel-sub">{t('account.quota.sub')}</p>

            <div className={`zx-quota${over ? ' is-over' : ''}`}>
                <div className="zx-quota-bar">
                    <span style={{ width: `${Math.min(percent, 100)}%` }} />
                </div>
                <p className="zx-quota-line">
                    {t('account.quota.used')
                        .replace('{percent}', String(percent))
                        .replace('{used}', formatFileSize(taken))
                        .replace('{max}', formatFileSize(max))}
                </p>
                {over && <p className="zx-profile-error">{t('account.quota.over')}</p>}
            </div>
        </section>
    );
};

export default AccountQuota;
