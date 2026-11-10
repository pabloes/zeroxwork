import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from '../../i18n';
import { api } from '../../services/axios-setup';
import { useMemberSearch, memberLabel, type DirectoryMember } from '../../services/use-member-search';

/** One person on a project. `userId` is what makes the name a link to them. */
export interface MemberDraft {
    name: string;
    role: string;
    userId?: number | null;
    handle?: string | null;
}

export const MAX_MEMBERS = 20;

interface Props {
    value: MemberDraft[];
    onChange: (members: MemberDraft[]) => void;
}

/**
 * Who made the project. Not the article credits field: a project needs at least
 * one member, so this says so while the list is empty instead of waiting for
 * the save to be refused, and the order can be changed -- on a project page the
 * first name is the one that reads as "this is mostly theirs".
 */
/** Only what the "add myself" button needs out of the account. */
interface Me {
    id: number;
    /** What the site shows for them: their name, else Discord, else their
     *  on-chain name, else the automatic handle. Resolved by the server. */
    publicName: string;
    handle: string | null;
}

const ProjectMembersField: React.FC<Props> = ({ value, onChange }) => {
    const { t } = useTranslation();
    const { query, setQuery, results, setResults, searching, enoughTyped } = useMemberSearch();

    // Same cache key as the account page, so this costs nothing once loaded.
    const { data: me } = useQuery<Me>({
        queryKey: ['userInfo'],
        queryFn: async () => (await api.get('/user/me')).data,
    });

    const alreadyThere = (name: string) =>
        value.some((member) => member.name.trim().toLowerCase() === name.trim().toLowerCase());

    const add = (member: MemberDraft) => {
        if (value.length >= MAX_MEMBERS || member.name.trim() === '' || alreadyThere(member.name)) return;
        onChange([...value, { ...member, name: member.name.trim() }]);
    };

    const addMember = (member: DirectoryMember) => {
        // Both the id and the handle: the handle is the nicer link, and the id
        // is what keeps a member who never picked one from losing theirs.
        add({ name: memberLabel(member), role: '', userId: member.id, handle: member.handle });
        setQuery('');
        setResults([]);
    };

    /** The account filling the form, under the name the site shows for them. */
    const addMe = (account: Me) =>
        add({ name: account.publicName, role: '', userId: account.id, handle: account.handle });

    const setRole = (index: number, role: string) =>
        onChange(value.map((member, i) => (i === index ? { ...member, role } : member)));

    const remove = (index: number) => onChange(value.filter((_, i) => i !== index));

    const move = (index: number, by: -1 | 1) => {
        const target = index + by;
        if (target < 0 || target >= value.length) return;
        const next = [...value];
        [next[index], next[target]] = [next[target], next[index]];
        onChange(next);
    };

    const full = value.length >= MAX_MEMBERS;

    // Whoever is filling this form is nearly always on the project, and making
    // them search for their own name is silly: they have to know what the site
    // decided to call them before they can find it. Gone once they are in.
    const meAlready = me !== undefined && value.some((member) => member.userId === me.id);
    const canAddMe = me !== undefined && !meAlready && !full;

    return (
        <div className="uk-margin">
            <label className="uk-form-label">{t('project.members')}</label>
            <div className="uk-form-controls">
                <p className="uk-text-meta uk-margin-remove-top">{t('project.members_hint')}</p>

                {canAddMe && (
                    <p className="uk-margin-small-bottom">
                        <button
                            type="button"
                            className="uk-button uk-button-default uk-button-small"
                            onClick={() => addMe(me)}
                        >
                            + {t('project.add_myself')}
                        </button>
                    </p>
                )}

                {value.length === 0 && (
                    <p className="zx-form-error">{t('project.members_required')}</p>
                )}

                {value.length > 0 && (
                    <ul className="zx-credit-rows uk-list uk-margin-small-bottom">
                        {value.map((member, index) => (
                            <li key={`${member.name}-${index}`} className="uk-grid-small uk-flex-middle" uk-grid="">
                                <div className="uk-width-auto">
                                    <span className="zx-chip">
                                        {member.name}
                                        {member.userId || member.handle ? ` · ${t('credits.linked')}` : ''}
                                    </span>
                                </div>
                                <div className="uk-width-expand">
                                    <input
                                        className="uk-input uk-form-small"
                                        type="text"
                                        value={member.role}
                                        onChange={(e) => setRole(index, e.target.value)}
                                        placeholder={t('credits.role_placeholder')}
                                        aria-label={t('credits.role_placeholder')}
                                    />
                                </div>
                                <div className="uk-width-auto">
                                    <button
                                        type="button"
                                        className="zx-icon-btn"
                                        onClick={() => move(index, -1)}
                                        disabled={index === 0}
                                        aria-label={t('project.member_earlier')}
                                    >↑</button>
                                    <button
                                        type="button"
                                        className="zx-icon-btn"
                                        onClick={() => move(index, 1)}
                                        disabled={index === value.length - 1}
                                        aria-label={t('project.member_later')}
                                    >↓</button>
                                    <button
                                        type="button"
                                        className="zx-icon-btn"
                                        onClick={() => remove(index)}
                                        aria-label={`${t('credits.remove')}: ${member.name}`}
                                    >✕</button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}

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
                                            {member.displayName && member.handle ? ` (@${member.handle})` : ''}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}

                        {!searching && enoughTyped && results.length === 0 && (
                            <p className="uk-text-meta">{t('credits.no_results')}</p>
                        )}

                        <FreeName onAdd={(name) => add({ name, role: '' })} />
                    </>
                )}

                {full && <p className="uk-text-meta">{t('credits.full')}</p>}
            </div>
        </div>
    );
};

/** Somebody with no account on the site, added by name. */
const FreeName: React.FC<{ onAdd: (name: string) => void }> = ({ onAdd }) => {
    const { t } = useTranslation();
    const [name, setName] = useState('');

    const submit = () => {
        if (name.trim() === '') return;
        onAdd(name);
        setName('');
    };

    return (
        <div className="uk-grid-small uk-flex-middle" uk-grid="">
            <div className="uk-width-expand">
                <input
                    className="uk-input"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('credits.name_placeholder')}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            submit();
                        }
                    }}
                />
            </div>
            <div>
                <button type="button" className="uk-button uk-button-default" onClick={submit}>
                    {t('credits.add')}
                </button>
            </div>
        </div>
    );
};

export default ProjectMembersField;
