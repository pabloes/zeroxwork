/**
 * Every account has a public name and a public handle, because the alternative
 * is showing "Anonymous" or an email address. Both are derived from the best
 * source available, in this order:
 *
 *   1. the name the member typed on /account  (`displayName`)
 *   2. their linked Discord name
 *   3. their default on-chain name            (`pablo.dcl.eth`)
 *   4. an automatic one built from the account id
 *
 * The name is resolved on every read rather than written once, so a member who
 * links Discord or buys a name gets the better one with no backfill, and the
 * name they typed always wins. The handle is the opposite: it is part of a URL,
 * so it is stored once and only ever replaced while it is still automatic.
 */

import { HANDLE_MAX, HANDLE_MIN, validateHandle } from './profile.js';

/** Shape of the data the resolver needs. All parts are optional. */
export interface PublicNameSources {
    id: number;
    displayName?: string | null;
    handle?: string | null;
    discordLink?: { globalName?: string | null; username?: string | null } | null;
    defaultName?: { name?: string | null } | null;
}

/** The automatic handle for an account with nothing better to go on. */
export function autoHandle(id: number): string {
    return `member-${id}`;
}

/**
 * True when a handle is still the automatic one. Only these may be replaced:
 * anything else was either chosen by the member or already derived from a real
 * name, and silently changing it would break a URL someone may have shared.
 */
export function isAutoHandle(handle: string | null | undefined): boolean {
    return typeof handle === 'string' && /^member-\d+$/.test(handle);
}

/** `pablo.dcl.eth` -> `pablo`. Leaves a name without a known suffix alone. */
export function stripNameSuffix(name: string): string {
    return name.replace(/\.(dcl|base|eth|crypto|nft|x)(\.eth)?$/i, '');
}

/** The Discord name worth showing: the global display name, else the username. */
function discordName(sources: PublicNameSources): string | null {
    const link = sources.discordLink;
    if (!link) return null;
    const name = (link.globalName || link.username || '').trim();
    return name === '' ? null : name;
}

/**
 * The name to show for an account, never null and never the email address.
 * Falls through the four sources above.
 */
export function resolvePublicName(sources: PublicNameSources): string {
    const typed = (sources.displayName || '').trim();
    if (typed !== '') return typed;

    const discord = discordName(sources);
    if (discord) return discord;

    const onChain = (sources.defaultName?.name || '').trim();
    if (onChain !== '') return onChain;

    // The stored handle, when there is one, is already the best automatic label
    // we have; it only differs from autoHandle() if it was derived from a name.
    return sources.handle || autoHandle(sources.id);
}

/**
 * A handle shaped out of a free-form name, or null when nothing usable is left.
 * Lowercased and hyphenated to match validateHandle, which also rejects the
 * reserved words, so a Discord user called "admin" cannot claim /member/admin.
 */
export function handleCandidate(source: string | null | undefined): string | null {
    if (!source) return null;

    const slug = stripNameSuffix(String(source))
        .toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '') // é -> e, so the URL stays ascii
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, HANDLE_MAX)
        .replace(/-+$/g, '');

    if (slug.length < HANDLE_MIN) return null;

    const checked = validateHandle(slug);
    return checked.ok ? checked.value : null;
}

/**
 * Handle candidates for an account, best first: their Discord name, then their
 * on-chain name, then the automatic one, which is always valid and unique.
 */
export function handleCandidates(sources: PublicNameSources): string[] {
    const candidates = [
        handleCandidate(discordName(sources)),
        handleCandidate(sources.defaultName?.name),
    ].filter((candidate): candidate is string => candidate !== null);

    return [...new Set([...candidates, autoHandle(sources.id)])];
}
