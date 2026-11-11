import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/axios-setup';
import { useTranslation } from '../i18n';
import DiscordIcon from './DiscordIcon';

interface DiscordLink {
    discordId: string;
    username: string;
    globalName: string | null;
    avatar: string | null;
    linkedAt: string;
}

interface DiscordLinkResponse {
    configured: boolean;
    link: DiscordLink | null;
}

/** Callback outcomes, mapped to the message the user actually needs. */
const STATUS_KEYS: Record<string, string> = {
    linked: 'account.discord.status_linked',
    denied: 'account.discord.status_denied',
    already_linked: 'account.discord.status_already_linked',
    invalid_state: 'account.discord.status_expired',
    expired_state: 'account.discord.status_expired',
    invalid_request: 'account.discord.status_expired',
};

function avatarUrl(link: DiscordLink): string | null {
    if (!link.avatar) return null;
    return `https://cdn.discordapp.com/avatars/${link.discordId}/${link.avatar}.png?size=64`;
}

const BindDiscord: React.FC = () => {
    const { t, lang } = useTranslation();
    const queryClient = useQueryClient();
    const [status, setStatus] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const { data, isLoading } = useQuery<DiscordLinkResponse>({
        queryKey: ['discord-link'],
        queryFn: async () => (await api.get('/discord/link')).data,
    });

    // the callback comes back as /account?discord=<outcome>
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const outcome = params.get('discord');
        if (!outcome) return;

        setStatus(STATUS_KEYS[outcome] ?? 'account.discord.status_error');
        queryClient.invalidateQueries({ queryKey: ['discord-link'] });

        params.delete('discord');
        const query = params.toString();
        window.history.replaceState({}, '', window.location.pathname + (query ? `?${query}` : ''));
    }, [queryClient]);

    const startLinking = async () => {
        setBusy(true);
        try {
            const { data: started } = await api.post('/discord/oauth/start');
            window.location.href = started.url;
        } catch {
            setStatus('account.discord.status_error');
            setBusy(false);
        }
    };

    const unlink = async () => {
        if (!window.confirm(t('account.discord.confirm_unlink'))) return;
        setBusy(true);
        try {
            await api.delete('/discord/link');
            setStatus('account.discord.status_unlinked');
            await queryClient.invalidateQueries({ queryKey: ['discord-link'] });
        } catch {
            setStatus('account.discord.status_error');
        } finally {
            setBusy(false);
        }
    };

    // nothing to offer until the integration is configured on the server
    if (isLoading || !data?.configured) return null;

    const link = data.link;

    return (
        <section className="zx-panel">
            <h3 className="zx-panel-title zx-panel-title-icon">
                <DiscordIcon className="zx-discord-icon" size={22} />
                {t('account.discord.title')}
            </h3>
            <p className="zx-panel-sub">{t('account.discord.description')}</p>

            {status && <p className="zx-panel-status">{t(status)}</p>}

            {link ? (
                <div className="zx-discord-linked">
                    {avatarUrl(link) && <img src={avatarUrl(link) as string} alt="" width={40} height={40} />}
                    <div>
                        <strong>{link.globalName || link.username}</strong>
                        <span className="zx-post-meta">
                            {t('account.discord.linked_since')} {new Date(link.linkedAt).toLocaleDateString(lang === 'pt-br' ? 'pt-BR' : lang)}
                        </span>
                    </div>
                    <button type="button" className="zx-btn zx-btn-ghost" onClick={unlink} disabled={busy}>
                        {t('account.discord.unlink_button')}
                    </button>
                </div>
            ) : (
                <button type="button" className="zx-btn zx-btn-primary" onClick={startLinking} disabled={busy}>
                    <DiscordIcon size={18} />
                    {t('account.discord.link_button')} <span className="arr">→</span>
                </button>
            )}
        </section>
    );
};

export default BindDiscord;
