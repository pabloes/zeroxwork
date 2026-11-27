import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
    // `?welcome=discord`: Login sends a member here right after they verified
    // and signed in for the first time. Kept in state because the parameter is
    // stripped from the address straight away, so a reload is a plain /account.
    const [welcome, setWelcome] = useState(false);

    const { data, isLoading } = useQuery<DiscordLinkResponse>({
        queryKey: ['discord-link'],
        queryFn: async () => (await api.get('/discord/link')).data,
    });

    // the callback comes back as /account?discord=<outcome>, and a member who
    // has just finished registering arrives as /account?welcome=discord
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const outcome = params.get('discord');
        const invited = params.get('welcome') === 'discord';
        if (!outcome && !invited) return;

        if (invited) setWelcome(true);
        if (outcome) {
            setStatus(STATUS_KEYS[outcome] ?? 'account.discord.status_error');
            queryClient.invalidateQueries({ queryKey: ['discord-link'] });
        }

        params.delete('discord');
        params.delete('welcome');
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
    // The invitation only makes sense while there is nothing linked: coming
    // back from Discord lands on the normal panel with its "linked" notice.
    const inviting = welcome && !link;

    return (
        <section className={inviting ? 'zx-panel zx-panel-invite' : 'zx-panel'}>
            <h3 className="zx-panel-title zx-panel-title-icon">
                <DiscordIcon className="zx-discord-icon" size={22} />
                {t(inviting ? 'account.discord.welcome_title' : 'account.discord.title')}
            </h3>
            <p className="zx-panel-sub">{t(inviting ? 'account.discord.welcome_sub' : 'account.discord.description')}</p>

            {inviting && (
                <ul className="zx-discord-perks">
                    <li>{t('account.discord.perk_role')}</li>
                    <li>{t('account.discord.perk_channels')}</li>
                    <li>{t('account.discord.perk_contests')}</li>
                </ul>
            )}

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
                <div className="zx-discord-actions">
                    <button type="button" className="zx-btn zx-btn-primary" onClick={startLinking} disabled={busy}>
                        <DiscordIcon size={18} />
                        {t(inviting ? 'account.discord.welcome_button' : 'account.discord.link_button')} <span className="arr">→</span>
                    </button>
                    {/* Skipping has to be as easy as accepting: the account is
                        already complete without Discord. */}
                    {inviting && (
                        <Link className="zx-btn zx-btn-ghost" to="/">{t('account.discord.welcome_skip')}</Link>
                    )}
                </div>
            )}
        </section>
    );
};

export default BindDiscord;
