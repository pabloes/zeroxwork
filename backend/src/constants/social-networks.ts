/**
 * Catalogue of social networks a user may link to their account.
 *
 * Single source of truth: the frontend reads it from GET /api/user/social-networks
 * instead of keeping its own copy. Adding a network here needs no migration,
 * because UserSocial.network is a plain string validated against these keys.
 */

export interface SocialNetwork {
    /** Stored in UserSocial.network. Never change one once it is in use. */
    key: string;
    label: string;
    /** 'handle' stores a username; 'url' stores the whole address. */
    type: 'handle' | 'url';
    placeholder: string;
    /** `{handle}` is replaced to build the profile link. null = show as text. */
    urlTemplate: string | null;
    /** Shown first in the sign-up form, without opening the picker. */
    featured?: boolean;
}

/** The stand-in username every placeholder is built around. */
const PLACEHOLDER_HANDLE = 'tu_usuario';

/**
 * Same thing, without the placeholder: most are the profile link with the
 * username swapped in, so writing them out one by one only invites them to
 * drift. A network states its own placeholder when the rule does not fit it:
 * the ones that store a whole address (there is no template to fill), and
 * Bluesky, whose username carries its server.
 */
type CatalogueEntry = Omit<SocialNetwork, 'placeholder'> & { placeholder?: string };

const CATALOGUE: CatalogueEntry[] = [
    // --- featured: the ones most people fill in ---
    { key: 'x', label: 'X (Twitter)', type: 'handle', urlTemplate: 'https://x.com/{handle}', featured: true },
    { key: 'instagram', label: 'Instagram', type: 'handle', urlTemplate: 'https://instagram.com/{handle}', featured: true },
    { key: 'youtube', label: 'YouTube', type: 'url', placeholder: 'https://youtube.com/@tu_canal', urlTemplate: '{handle}', featured: true },
    { key: 'reddit', label: 'Reddit', type: 'handle', urlTemplate: 'https://reddit.com/user/{handle}', featured: true },

    // --- code ---
    { key: 'github', label: 'GitHub', type: 'handle', urlTemplate: 'https://github.com/{handle}' },
    { key: 'gitlab', label: 'GitLab', type: 'handle', urlTemplate: 'https://gitlab.com/{handle}' },
    { key: 'codepen', label: 'CodePen', type: 'handle', urlTemplate: 'https://codepen.io/{handle}' },

    // --- chat ---
    // Discord has no public profile URL, so the handle is shown as plain text.
    { key: 'discord', label: 'Discord', type: 'handle', urlTemplate: null },
    { key: 'telegram', label: 'Telegram', type: 'handle', urlTemplate: 'https://t.me/{handle}' },

    // --- web3 ---
    { key: 'farcaster', label: 'Farcaster', type: 'handle', urlTemplate: 'https://warpcast.com/{handle}' },
    { key: 'lens', label: 'Lens', type: 'handle', urlTemplate: 'https://hey.xyz/u/{handle}' },

    // --- design and 3d ---
    { key: 'behance', label: 'Behance', type: 'handle', urlTemplate: 'https://behance.net/{handle}' },
    { key: 'dribbble', label: 'Dribbble', type: 'handle', urlTemplate: 'https://dribbble.com/{handle}' },
    { key: 'artstation', label: 'ArtStation', type: 'handle', urlTemplate: 'https://artstation.com/{handle}' },
    { key: 'sketchfab', label: 'Sketchfab', type: 'handle', urlTemplate: 'https://sketchfab.com/{handle}' },
    { key: 'itch', label: 'itch.io', type: 'handle', urlTemplate: 'https://{handle}.itch.io' },

    // --- other social ---
    { key: 'tiktok', label: 'TikTok', type: 'handle', urlTemplate: 'https://tiktok.com/@{handle}' },
    { key: 'twitch', label: 'Twitch', type: 'handle', urlTemplate: 'https://twitch.tv/{handle}' },
    { key: 'linkedin', label: 'LinkedIn', type: 'handle', urlTemplate: 'https://linkedin.com/in/{handle}' },
    // Mastodon and Bluesky handles carry their server, so a template cannot build them.
    { key: 'mastodon', label: 'Mastodon', type: 'url', placeholder: 'https://mastodon.social/@tu_usuario', urlTemplate: '{handle}' },
    { key: 'bluesky', label: 'Bluesky', type: 'handle', placeholder: 'https://bsky.app/profile/tu_usuario.bsky.social', urlTemplate: 'https://bsky.app/profile/{handle}' },

    // --- free form ---
    { key: 'website', label: 'Web', type: 'url', placeholder: 'https://tu-web.com', urlTemplate: '{handle}' },
];

/**
 * The whole address rather than a bare username, because "tu_usuario" leaves
 * people guessing whether the field wants the name, the @name or the link. The
 * link answers all three at once, and a pasted one is understood anyway.
 */
export const SOCIAL_NETWORKS: SocialNetwork[] = CATALOGUE.map((network) => ({
    ...network,
    placeholder: network.placeholder
        ?? network.urlTemplate?.replace('{handle}', PLACEHOLDER_HANDLE)
        ?? PLACEHOLDER_HANDLE,
}));

export const SOCIAL_NETWORKS_BY_KEY = new Map(SOCIAL_NETWORKS.map((n) => [n.key, n]));

const HANDLE_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,62}[A-Za-z0-9])?$/;
const MAX_URL_LENGTH = 300;

export interface NormalizedSocial {
    network: string;
    handle: string;
}

export class InvalidSocialError extends Error {
    constructor(public readonly network: string, message: string) {
        super(message);
        this.name = 'InvalidSocialError';
    }
}

/**
 * Turns whatever the user typed into what we store: a bare handle, or a http(s)
 * URL. Accepts a pasted profile link for handle networks and keeps the handle.
 * Throws InvalidSocialError when it cannot be made safe.
 */
export function normalizeSocial(network: string, rawHandle: string): NormalizedSocial | null {
    const definition = SOCIAL_NETWORKS_BY_KEY.get(network);
    if (!definition) {
        throw new InvalidSocialError(network, `Unknown social network: ${network}`);
    }

    const value = (rawHandle ?? '').trim();
    if (!value) return null; // empty means "not provided", not an error

    if (definition.type === 'url') {
        let parsed: URL;
        try {
            parsed = new URL(value);
        } catch {
            throw new InvalidSocialError(network, `${definition.label}: enter a full address starting with https://`);
        }
        // Only http(s): blocks javascript:, data: and friends from reaching an href.
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
            throw new InvalidSocialError(network, `${definition.label}: only http and https addresses are allowed`);
        }
        if (value.length > MAX_URL_LENGTH) {
            throw new InvalidSocialError(network, `${definition.label}: address is too long`);
        }
        return { network, handle: parsed.toString() };
    }

    // Handle networks: tolerate "@user", "u/user" and a pasted profile URL.
    let handle = value;
    if (handle.includes('://')) {
        try {
            const parsed = new URL(handle);
            // A few networks put the username in the subdomain rather than the
            // path (pablo.itch.io), and the path of those links is empty.
            handle = definition.urlTemplate?.startsWith('https://{handle}.')
                ? parsed.hostname.split('.')[0]
                : parsed.pathname.split('/').filter(Boolean).pop() ?? '';
        } catch {
            // fall through to the pattern check below
        }
    }
    handle = handle.replace(/^@+/, '').replace(/^u\//i, '').replace(/^in\//i, '');

    if (!HANDLE_PATTERN.test(handle)) {
        throw new InvalidSocialError(network, `${definition.label}: that username has characters we cannot accept`);
    }

    return { network, handle };
}

/** Builds the public link for a stored entry, or null when it is not linkable. */
export function socialUrl(network: string, handle: string): string | null {
    const definition = SOCIAL_NETWORKS_BY_KEY.get(network);
    if (!definition?.urlTemplate) return null;
    return definition.urlTemplate.replace('{handle}', handle);
}
