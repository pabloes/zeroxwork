import { useEffect, useRef, useState } from 'react';
import { api } from '../../services/axios-setup';
import { useTranslation } from '../../i18n';

/** What the form holds. `name` is what gets stored and shown; `userId` is what
 *  turns it into a link to that member's page. */
export interface CreditDraft {
    name: string;
    role: string;
    userId?: number | null;
    handle?: string | null;
}

interface Member {
    id: number;
    handle: string | null;
    displayName: string | null;
    avatarUrl: string | null;
}

const SEARCH_MIN = 2;
const SEARCH_WAIT = 300;
export const MAX_CREDITS = 20;

const memberLabel = (member: Member) => member.displayName || member.handle || `#${member.id}`;

const CreditsField: React.FC<{ value: CreditDraft[]; onChange: (credits: CreditDraft[]) => void }> = ({ value, onChange }) => {
    const { t } = useTranslation();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Member[]>([]);
    const [searching, setSearching] = useState(false);
    const [freeName, setFreeName] = useState('');
    const latest = useRef(0);

    // Debounced, and the stale-response guard matters here: typing fast enough
    // would otherwise let an earlier, slower answer overwrite a later one.
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

    const alreadyThere = (name: string) =>
        value.some((credit) => credit.name.trim().toLowerCase() === name.trim().toLowerCase());

    const add = (credit: CreditDraft) => {
        if (value.length >= MAX_CREDITS || credit.name.trim() === '' || alreadyThere(credit.name)) return;
        onChange([...value, { ...credit, name: credit.name.trim() }]);
    };

    const addMember = (member: Member) => {
        add({ name: memberLabel(member), role: '', userId: member.id, handle: member.handle });
        setQuery('');
        setResults([]);
    };

    const addFreeName = () => {
        add({ name: freeName, role: '' });
        setFreeName('');
    };

    const setRole = (index: number, role: string) =>
        onChange(value.map((credit, i) => (i === index ? { ...credit, role } : credit)));

    const remove = (index: number) => onChange(value.filter((_, i) => i !== index));

    const full = value.length >= MAX_CREDITS;

    return (
        <div className="uk-margin">
            <label className="uk-form-label">{t('credits.label')}</label>
            <div className="uk-form-controls">
                <p className="uk-text-meta uk-margin-remove-top">{t('credits.hint')}</p>

                {value.length > 0 && (
                    <ul className="zx-credit-rows uk-list uk-margin-small-bottom">
                        {value.map((credit, index) => (
                            <li key={`${credit.name}-${index}`} className="uk-grid-small uk-flex-middle" uk-grid="">
                                <div className="uk-width-auto">
                                    <span className="zx-chip">
                                        {credit.name}
                                        {credit.userId ? ` · ${t('credits.linked')}` : ''}
                                    </span>
                                </div>
                                <div className="uk-width-expand">
                                    <input
                                        className="uk-input uk-form-small"
                                        type="text"
                                        value={credit.role}
                                        onChange={(e) => setRole(index, e.target.value)}
                                        placeholder={t('credits.role_placeholder')}
                                        aria-label={t('credits.role_placeholder')}
                                    />
                                </div>
                                <div className="uk-width-auto">
                                    <button
                                        type="button"
                                        className="zx-tb-text"
                                        onClick={() => remove(index)}
                                        aria-label={`${t('credits.remove')}: ${credit.name}`}
                                    >
                                        {t('credits.remove')}
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}

                {value.length === 0 && <p className="uk-text-meta">{t('credits.none')}</p>}

                {!full && (
                    <>
                        <input
                            className="uk-input uk-margin-small-bottom"
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={t('credits.search_placeholder')}
                        />

                        {searching && <p className="uk-text-meta">{t('credits.searching')}</p>}

                        {!searching && results.length > 0 && (
                            <ul className="zx-credit-results uk-list uk-margin-small-bottom">
                                {results.map((member) => (
                                    <li key={member.id}>
                                        <button type="button" className="zx-tb-text" onClick={() => addMember(member)}>
                                            {memberLabel(member)}
                                            {member.handle ? ` (@${member.handle})` : ''}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}

                        {!searching && query.trim().length >= SEARCH_MIN && results.length === 0 && (
                            <p className="uk-text-meta">{t('credits.no_results')}</p>
                        )}

                        <div className="uk-grid-small uk-flex-middle" uk-grid="">
                            <div className="uk-width-expand">
                                <input
                                    className="uk-input"
                                    type="text"
                                    value={freeName}
                                    onChange={(e) => setFreeName(e.target.value)}
                                    placeholder={t('credits.name_placeholder')}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            addFreeName();
                                        }
                                    }}
                                />
                            </div>
                            <div>
                                <button type="button" className="uk-button uk-button-default" onClick={addFreeName}>
                                    {t('credits.add')}
                                </button>
                            </div>
                        </div>
                    </>
                )}

                {full && <p className="uk-text-meta">{t('credits.full')}</p>}
            </div>
        </div>
    );
};

export default CreditsField;
