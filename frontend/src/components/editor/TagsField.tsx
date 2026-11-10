import { useMemo, useRef, useState } from 'react';
import { useTranslation } from '../../i18n';

export interface TagOption {
    id: number;
    name: string;
}

export interface TagSelection {
    /** Tags that already exist, by id. */
    tagIds: number[];
    /** Tags typed here that the server will have to create. */
    newTags: string[];
}

/** How many suggestions to show at once. More than this is a list, not a hint. */
const MAX_SUGGESTIONS = 8;

const norm = (name: string) => name.trim().toLowerCase();

/**
 * One text field for all the tags, existing and new.
 *
 * It used to be a checkbox per tag in the database, which works for ten tags
 * and becomes a wall at fifty: the author had to read every tag the site has
 * ever used to find the two they wanted. Here they type, and what already
 * exists is offered; what does not, they add. Either way the field below is
 * the same row of chips, because from the author's side there is no difference
 * between picking a tag and inventing one.
 */
const TagsField: React.FC<{
    all: TagOption[];
    value: TagSelection;
    onChange: (value: TagSelection) => void;
    /** The project form calls this field something else. */
    label?: string;
}> = ({ all, value, onChange, label }) => {
    const { t } = useTranslation();
    const [query, setQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    const chosen = useMemo(
        () => all.filter((tag) => value.tagIds.includes(tag.id)),
        [all, value.tagIds],
    );

    const takenNames = useMemo(
        () => new Set([...chosen.map((tag) => norm(tag.name)), ...value.newTags.map(norm)]),
        [chosen, value.newTags],
    );

    // What the site already has, matching what they are typing and not already
    // on the article.
    const suggestions = useMemo(() => {
        const typed = norm(query);
        if (typed === '') return [];
        return all
            .filter((tag) => !takenNames.has(norm(tag.name)) && norm(tag.name).includes(typed))
            // The ones that start with what you typed first: that is what you meant.
            .sort((a, b) => Number(norm(b.name).startsWith(typed)) - Number(norm(a.name).startsWith(typed)))
            .slice(0, MAX_SUGGESTIONS);
    }, [all, query, takenNames]);

    const addExisting = (tag: TagOption) => {
        if (!value.tagIds.includes(tag.id)) {
            onChange({ ...value, tagIds: [...value.tagIds, tag.id] });
        }
        setQuery('');
        inputRef.current?.focus();
    };

    /**
     * Enter, or the add button. A name that already exists is that tag, not a
     * second one with the same name: the author cannot be expected to know
     * which tags the database has, and two "webgl" would be a mess nobody
     * asked for.
     */
    const addTyped = () => {
        const typed = query.trim();
        if (typed === '' || takenNames.has(norm(typed))) {
            setQuery('');
            return;
        }

        const existing = all.find((tag) => norm(tag.name) === norm(typed));
        if (existing) return addExisting(existing);

        onChange({ ...value, newTags: [...value.newTags, typed] });
        setQuery('');
    };

    const removeExisting = (id: number) =>
        onChange({ ...value, tagIds: value.tagIds.filter((tagId) => tagId !== id) });

    const removeNew = (name: string) =>
        onChange({ ...value, newTags: value.newTags.filter((tag) => tag !== name) });

    const nothingChosen = chosen.length === 0 && value.newTags.length === 0;

    return (
        <div className="uk-margin">
            <label className="uk-form-label" htmlFor="zx-tag-input">{label ?? t('tags.label')}</label>
            <div className="uk-form-controls">
                <p className="uk-text-meta uk-margin-remove-top">{t('tags.hint')}</p>

                {!nothingChosen && (
                    <div className="uk-margin-small-bottom zx-tag-chips">
                        {chosen.map((tag) => (
                            <span key={`id-${tag.id}`} className="zx-chip uk-margin-small-right">
                                {tag.name}
                                <button
                                    type="button"
                                    className="zx-tb-text"
                                    style={{ marginLeft: '6px' }}
                                    onClick={() => removeExisting(tag.id)}
                                    aria-label={`${t('tags.remove')}: ${tag.name}`}
                                >
                                    ×
                                </button>
                            </span>
                        ))}
                        {value.newTags.map((name) => (
                            <span key={`new-${name}`} className="zx-chip uk-margin-small-right">
                                {name} · {t('tags.new_badge')}
                                <button
                                    type="button"
                                    className="zx-tb-text"
                                    style={{ marginLeft: '6px' }}
                                    onClick={() => removeNew(name)}
                                    aria-label={`${t('tags.remove')}: ${name}`}
                                >
                                    ×
                                </button>
                            </span>
                        ))}
                    </div>
                )}

                <div className="uk-grid-small uk-flex-middle" uk-grid="">
                    <div className="uk-width-expand">
                        <input
                            id="zx-tag-input"
                            ref={inputRef}
                            className="uk-input"
                            type="text"
                            value={query}
                            autoComplete="off"
                            placeholder={t('tags.placeholder')}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    // Enter in a text field submits the form; here it
                                    // means "add this tag" and nothing else.
                                    e.preventDefault();
                                    addTyped();
                                }
                                // Backspace on an empty field takes the last chip off,
                                // the way every tag field does.
                                if (e.key === 'Backspace' && query === '') {
                                    if (value.newTags.length > 0) removeNew(value.newTags[value.newTags.length - 1]);
                                    else if (chosen.length > 0) removeExisting(chosen[chosen.length - 1].id);
                                }
                            }}
                        />
                    </div>
                    <div>
                        <button type="button" className="uk-button uk-button-default" onClick={addTyped}>
                            {t('tags.add')}
                        </button>
                    </div>
                </div>

                {/* Same list style as the member search: it is the same gesture. */}
                {suggestions.length > 0 && (
                    <ul className="zx-credit-results uk-list uk-margin-small-top">
                        {suggestions.map((tag) => (
                            <li key={tag.id}>
                                <button type="button" className="zx-tb-text" onClick={() => addExisting(tag)}>
                                    {tag.name}
                                </button>
                            </li>
                        ))}
                    </ul>
                )}

                {query.trim() !== '' && suggestions.length === 0 && !takenNames.has(norm(query)) && (
                    <p className="uk-text-meta">{t('tags.will_create')}</p>
                )}
            </div>
        </div>
    );
};

export default TagsField;
