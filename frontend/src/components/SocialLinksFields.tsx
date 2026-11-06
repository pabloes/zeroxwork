import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../services/axios-setup';
import { useTranslation } from '../i18n';

/** Mirrors SocialNetwork in the backend catalogue, fetched at runtime. */
interface SocialNetwork {
    key: string;
    label: string;
    type: 'handle' | 'url';
    placeholder: string;
    urlTemplate: string | null;
    featured?: boolean;
}

interface Props {
    /** { networkKey: handle }. Blank values are kept so the input stays mounted. */
    value: Record<string, string>;
    onChange: (next: Record<string, string>) => void;
}

/**
 * Featured networks are always visible; the rest are added from a searchable
 * picker. The catalogue comes from the API so there is a single list.
 */
const SocialLinksFields: React.FC<Props> = ({ value, onChange }) => {
    const { t } = useTranslation();
    const [networks, setNetworks] = useState<SocialNetwork[]>([]);
    const [query, setQuery] = useState('');
    const [pickerOpen, setPickerOpen] = useState(false);
    const pickerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let cancelled = false;
        api.get('/user/social-networks')
            .then((response) => {
                if (!cancelled) setNetworks(response.data?.networks ?? []);
            })
            // The picker simply stays empty: sign-up must not break over this.
            .catch(() => undefined);
        return () => { cancelled = true; };
    }, []);

    // Close the picker when clicking outside of it.
    useEffect(() => {
        if (!pickerOpen) return;
        const onDocumentClick = (event: MouseEvent) => {
            if (!pickerRef.current?.contains(event.target as Node)) setPickerOpen(false);
        };
        document.addEventListener('mousedown', onDocumentClick);
        return () => document.removeEventListener('mousedown', onDocumentClick);
    }, [pickerOpen]);

    const featured = useMemo(() => networks.filter((n) => n.featured), [networks]);
    const added = useMemo(
        () => networks.filter((n) => !n.featured && value[n.key] !== undefined),
        [networks, value]
    );
    const selectable = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return networks.filter(
            (n) => !n.featured && value[n.key] === undefined && (!needle || n.label.toLowerCase().includes(needle))
        );
    }, [networks, value, query]);

    const setHandle = (key: string, handle: string) => onChange({ ...value, [key]: handle });

    const addNetwork = (key: string) => {
        onChange({ ...value, [key]: '' });
        setQuery('');
        setPickerOpen(false);
    };

    const removeNetwork = (key: string) => {
        const next = { ...value };
        delete next[key];
        onChange(next);
    };

    const renderField = (network: SocialNetwork, removable: boolean) => (
        <div className="uk-margin-small" key={network.key}>
            <label className="uk-form-label" htmlFor={`social-${network.key}`}>{network.label}</label>
            <div className="uk-flex" style={{ gap: '.5rem' }}>
                <input
                    id={`social-${network.key}`}
                    className="uk-input"
                    type={network.type === 'url' ? 'url' : 'text'}
                    placeholder={network.placeholder}
                    value={value[network.key] ?? ''}
                    onChange={(e) => setHandle(network.key, e.target.value)}
                />
                {removable && (
                    <button
                        type="button"
                        className="uk-button uk-button-default"
                        onClick={() => removeNetwork(network.key)}
                    >
                        {t('socials.remove')}
                    </button>
                )}
            </div>
        </div>
    );

    if (!networks.length) return null;

    return (
        <fieldset className="uk-fieldset uk-margin">
            <legend className="uk-legend" style={{ fontSize: '1rem' }}>{t('socials.title')}</legend>
            <p className="uk-text-meta">{t('socials.hint')}</p>

            {featured.map((network) => renderField(network, false))}
            {added.map((network) => renderField(network, true))}

            <div className="uk-margin-small" ref={pickerRef} style={{ position: 'relative' }}>
                {pickerOpen ? (
                    <>
                        <input
                            className="uk-input"
                            type="text"
                            autoFocus
                            placeholder={t('socials.search_placeholder')}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Escape') setPickerOpen(false);
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    if (selectable[0]) addNetwork(selectable[0].key);
                                }
                            }}
                            aria-expanded={pickerOpen}
                            aria-label={t('socials.search_placeholder')}
                        />
                        <ul
                            className="uk-list uk-background-default"
                            style={{
                                position: 'absolute', zIndex: 10, left: 0, right: 0, margin: 0,
                                maxHeight: '14rem', overflowY: 'auto',
                                border: '1px solid rgba(128,128,128,.35)', borderRadius: '4px',
                            }}
                        >
                            {selectable.length ? selectable.map((network) => (
                                <li key={network.key} style={{ margin: 0 }}>
                                    <button
                                        type="button"
                                        className="uk-button uk-button-link uk-width-1-1 uk-text-left"
                                        style={{ padding: '.35rem .75rem' }}
                                        onClick={() => addNetwork(network.key)}
                                    >
                                        {network.label}
                                    </button>
                                </li>
                            )) : (
                                <li className="uk-text-meta" style={{ padding: '.35rem .75rem' }}>
                                    {t('socials.no_results')}
                                </li>
                            )}
                        </ul>
                    </>
                ) : (
                    <button
                        type="button"
                        className="uk-button uk-button-default"
                        onClick={() => setPickerOpen(true)}
                    >
                        + {t('socials.add')}
                    </button>
                )}
            </div>
        </fieldset>
    );
};

export default SocialLinksFields;
