import { useEffect, useRef, useState } from 'react';
import { api } from './axios-setup';

/** A member as the public directory returns them. */
export interface DirectoryMember {
    id: number;
    handle: string | null;
    displayName: string | null;
    avatarUrl: string | null;
}

const SEARCH_MIN = 2;
const SEARCH_WAIT = 300;

/** What to show for a member: their public name, with the handle as a fallback. */
export const memberLabel = (member: DirectoryMember) =>
    member.displayName || member.handle || `member-${member.id}`;

/**
 * Typeahead over the public member directory, shared by the credits field and
 * the project members field.
 *
 * Debounced, and the stale-response guard matters: typing fast enough would
 * otherwise let an earlier, slower answer overwrite a later one.
 */
export function useMemberSearch() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<DirectoryMember[]>([]);
    const [searching, setSearching] = useState(false);
    const latest = useRef(0);

    useEffect(() => {
        const term = query.trim();
        if (term.length < SEARCH_MIN) {
            setResults([]);
            setSearching(false);
            return;
        }

        setSearching(true);
        const ticket = ++latest.current;
        const timer = setTimeout(async () => {
            try {
                const response = await api.get('/user/members', { params: { q: term } });
                if (ticket === latest.current) setResults(response.data);
            } catch {
                if (ticket === latest.current) setResults([]);
            } finally {
                if (ticket === latest.current) setSearching(false);
            }
        }, SEARCH_WAIT);

        return () => clearTimeout(timer);
    }, [query]);

    const enoughTyped = query.trim().length >= SEARCH_MIN;

    return { query, setQuery, results, setResults, searching, enoughTyped };
}
