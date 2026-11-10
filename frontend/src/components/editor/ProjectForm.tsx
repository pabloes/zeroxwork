import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../services/axios-setup';
import { useTranslation } from '../../i18n';
import { slugify } from '../../utils/slug';
import ArticleEditor from './ArticleEditor';
import ImagePicker from './ImagePicker';
import ProjectMediaField from './ProjectMediaField';
import TagsField from './TagsField';
import ProjectMembersField, { type MemberDraft } from './ProjectMembersField';
import { SCREENSHOTS_MIN, isAllowedVideoUrl } from '../../services/project-media';
import {
    PROJECT_STATUSES,
    REPO_HOSTS,
    SUMMARY_MAX,
    isAllowedRepoUrl,
    isAllowedSiteUrl,
} from '../../services/project-fields';
import type { Project, ProjectPayload } from '../../services/use-projects';

const SUPPORTED_LANGS = [
    { code: 'es', name: 'Español' },
    { code: 'en', name: 'English' },
    { code: 'pt-br', name: 'Português (Brasil)' },
    { code: 'zh', name: '中文' },
    { code: 'fr', name: 'Français' },
];

interface Tag {
    id: number;
    name: string;
}

interface Props {
    /** The project being edited, or nothing when one is being entered. */
    initial?: Project;
    submitting: boolean;
    error: string | null;
    onSubmit: (payload: ProjectPayload) => void;
}

/** A stored date as a date field wants it: YYYY-MM-DD, or empty. */
const asDateValue = (value: string | null | undefined) =>
    value ? new Date(value).toISOString().slice(0, 10) : '';

/**
 * The project form, for both the alta and the edit.
 *
 * Deliberately not the article form. There is no category to pick -- being here
 * is what makes it a project -- no embed, no link type, and no redirect: those
 * are blog things. What a project has instead is a gallery it cannot do without,
 * the people who made it, the dates it ran, and where to go see it.
 *
 * The gallery and the cover are demanded when the project is entered and never
 * again: the projects that came over from the blog have no screenshots, and an
 * edit is how they get some.
 */
const ProjectForm: React.FC<Props> = ({ initial, submitting, error, onSubmit }) => {
    const { t } = useTranslation();
    const creating = initial === undefined;

    const [title, setTitle] = useState(initial?.title ?? '');
    const [slug, setSlug] = useState(initial?.slug ?? '');
    const [autoSlug, setAutoSlug] = useState(creating);
    const [lang, setLang] = useState(initial?.lang ?? 'es');
    const [summary, setSummary] = useState(initial?.summary ?? '');
    const [content, setContent] = useState(initial?.content ?? '');
    const [thumbnail, setThumbnail] = useState(initial?.thumbnail ?? '');
    const [coverPickerOpen, setCoverPickerOpen] = useState(false);
    const [screenshots, setScreenshots] = useState<string[]>(initial?.screenshots ?? []);
    const [videoUrl, setVideoUrl] = useState(initial?.videoUrl ?? '');
    const [siteUrl, setSiteUrl] = useState(initial?.siteUrl ?? '');
    const [repoUrl, setRepoUrl] = useState(initial?.repoUrl ?? '');
    const [startedAt, setStartedAt] = useState(asDateValue(initial?.startedAt));
    const [endedAt, setEndedAt] = useState(asDateValue(initial?.endedAt));
    const [status, setStatus] = useState(initial?.status ?? '');
    const [selectedTagIds, setSelectedTagIds] = useState<number[]>(initial?.tags.map((tag) => tag.id) ?? []);
    const [newTags, setNewTags] = useState<string[]>([]);
    const [members, setMembers] = useState<MemberDraft[]>(
        initial?.members.map((member) => ({
            name: member.name,
            role: member.role ?? '',
            userId: member.userId,
            handle: member.handle,
        })) ?? [],
    );
    /** What the form itself refuses to send, shown where the fields are. */
    const [localError, setLocalError] = useState<string | null>(null);

    const { data: tags = [] } = useQuery({
        queryKey: ['tags'],
        queryFn: async (): Promise<Tag[]> => (await api.get('/blog/tags')).data,
    });

    useEffect(() => {
        if (autoSlug) setSlug(slugify(title));
    }, [title, autoSlug]);

    const reject = (key: string) => {
        setLocalError(t(key));
        return false;
    };

    /** Everything the server would refuse, said here so nobody waits for a round trip. */
    const looksSendable = () => {
        if (title.trim() === '') return reject('project.error.title_required');
        if (content.trim() === '') return reject('project.error.content_required');
        if (members.length === 0) return reject('project.error.members_required');
        if (summary.length > SUMMARY_MAX) return reject('project.error.summary_long');
        if (!isAllowedVideoUrl(videoUrl)) return reject('project.error.video_host');
        if (!isAllowedSiteUrl(siteUrl)) return reject('project.error.site_url');
        if (!isAllowedRepoUrl(repoUrl)) return reject('project.error.repo_url');
        if (startedAt !== '' && endedAt !== '' && endedAt < startedAt) {
            return reject('project.error.dates_backwards');
        }

        // Only at the alta: an edit of a project that predates the rule must not
        // be held to it, or the ones with no gallery could never get one.
        if (creating) {
            if (thumbnail.trim() === '') return reject('project.error.cover_required');
            if (screenshots.length < SCREENSHOTS_MIN) return reject('project.error.screenshots_few');
        }

        setLocalError(null);
        return true;
    };

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (!looksSendable()) return;

        onSubmit({
            title: title.trim(),
            summary: summary.trim(),
            content,
            lang,
            slug: slug.trim() || undefined,
            thumbnail: thumbnail.trim(),
            screenshots,
            videoUrl: videoUrl.trim(),
            siteUrl: siteUrl.trim(),
            repoUrl: repoUrl.trim(),
            startedAt: startedAt || '',
            endedAt: endedAt || '',
            status,
            tagIds: selectedTagIds,
            newTags,
            members: members.map((member) => ({
                name: member.name,
                role: member.role || undefined,
                userId: member.userId ?? undefined,
                handle: member.handle ?? undefined,
            })),
        });
    };

    const shown = localError ?? error;

    return (
        <form className="uk-form-stacked" onSubmit={handleSubmit}>
            <div className="uk-margin">
                <label className="uk-form-label" htmlFor="title">{t('project.title_label')}</label>
                <div className="uk-form-controls">
                    <input
                        className="uk-input"
                        id="title"
                        type="text"
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        required
                        placeholder={t('project.title_placeholder')}
                    />
                </div>
                {/* Worth saying once: a project is called what it is called, and
                    the title is the one thing translation leaves alone. */}
                <p className="uk-text-meta">{t('project.title_not_translated')}</p>
            </div>

            <div className="uk-margin">
                <label className="uk-form-label" htmlFor="slug">{t('project.url_label')}</label>
                <div className="uk-form-controls uk-grid-small uk-flex-middle" uk-grid="">
                    <div className="uk-width-expand">
                        <input
                            className="uk-input"
                            id="slug"
                            type="text"
                            value={slug}
                            onChange={(event) => {
                                setSlug(event.target.value);
                                setAutoSlug(false);
                            }}
                            placeholder="project-url-handle"
                        />
                    </div>
                    <div>
                        <label>
                            <input
                                className="uk-checkbox"
                                type="checkbox"
                                checked={autoSlug}
                                onChange={(event) => setAutoSlug(event.target.checked)}
                            />{' '}
                            {t('project.url_auto')}
                        </label>
                    </div>
                </div>
                <p className="uk-text-meta">
                    {`${window.location.host}/portfolio/${slugify(slug) || (initial ? String(initial.id) : '...')}`}
                </p>
            </div>

            <div className="uk-margin">
                <label className="uk-form-label" htmlFor="lang">{t('project.lang_label')}</label>
                <div className="uk-form-controls">
                    <select
                        className="uk-select"
                        id="lang"
                        value={lang}
                        onChange={(event) => setLang(event.target.value)}
                    >
                        {SUPPORTED_LANGS.map((option) => (
                            <option key={option.code} value={option.code}>{option.name}</option>
                        ))}
                    </select>
                </div>
                <p className="uk-text-meta">{t('project.lang_hint')}</p>
            </div>

            <div className="uk-margin">
                <label className="uk-form-label" htmlFor="summary">{t('project.summary_label')}</label>
                <div className="uk-form-controls">
                    <textarea
                        className="uk-textarea"
                        id="summary"
                        rows={2}
                        value={summary}
                        maxLength={SUMMARY_MAX}
                        onChange={(event) => setSummary(event.target.value)}
                        placeholder={t('project.summary_placeholder')}
                    />
                </div>
                <p className="uk-text-meta">{`${summary.length} / ${SUMMARY_MAX}`}</p>
            </div>

            <div className="uk-margin">
                <label className="uk-form-label" htmlFor="thumbnail">
                    {creating ? t('project.cover_required') : t('project.cover')}
                </label>
                <div className="uk-form-controls zx-thumb-field">
                    <input
                        className="uk-input"
                        id="thumbnail"
                        type="text"
                        value={thumbnail}
                        onChange={(event) => setThumbnail(event.target.value)}
                        placeholder="/api/images/..."
                    />
                    <button type="button" className="zx-tb-text" onClick={() => setCoverPickerOpen(true)}>
                        {t('editor.image_from_library')}
                    </button>
                </div>
                {coverPickerOpen && (
                    <ImagePicker
                        onClose={() => setCoverPickerOpen(false)}
                        onSelect={(url) => {
                            setThumbnail(url);
                            setCoverPickerOpen(false);
                        }}
                    />
                )}
                {thumbnail !== '' && (
                    <div className="uk-margin-small-top">
                        <img
                            src={thumbnail}
                            alt=""
                            style={{ maxWidth: '240px', maxHeight: '160px', objectFit: 'cover' }}
                        />
                    </div>
                )}
            </div>

            {/* The gallery comes before the write-up here for the same reason it
                does on the page: a project is judged on what it shows. */}
            <ProjectMediaField
                screenshots={screenshots}
                onScreenshotsChange={setScreenshots}
                videoUrl={videoUrl}
                onVideoUrlChange={setVideoUrl}
            />

            <ProjectMembersField value={members} onChange={setMembers} />

            <div className="uk-margin uk-grid-small" uk-grid="">
                <div className="uk-width-1-3@s">
                    <label className="uk-form-label" htmlFor="startedAt">{t('project.started_label')}</label>
                    <input
                        className="uk-input"
                        id="startedAt"
                        type="date"
                        value={startedAt}
                        onChange={(event) => setStartedAt(event.target.value)}
                    />
                </div>
                <div className="uk-width-1-3@s">
                    <label className="uk-form-label" htmlFor="endedAt">{t('project.ended_label')}</label>
                    <input
                        className="uk-input"
                        id="endedAt"
                        type="date"
                        value={endedAt}
                        onChange={(event) => setEndedAt(event.target.value)}
                    />
                </div>
                <div className="uk-width-1-3@s">
                    <label className="uk-form-label" htmlFor="status">{t('project.status_label')}</label>
                    <select
                        className="uk-select"
                        id="status"
                        value={status}
                        onChange={(event) => setStatus(event.target.value)}
                    >
                        <option value="">{t('project.status_none')}</option>
                        {PROJECT_STATUSES.map((value) => (
                            <option key={value} value={value}>{t(`project.status_${value}`)}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="uk-margin">
                <label className="uk-form-label" htmlFor="siteUrl">{t('project.site_label')}</label>
                <div className="uk-form-controls">
                    <input
                        className="uk-input"
                        id="siteUrl"
                        type="url"
                        value={siteUrl}
                        onChange={(event) => setSiteUrl(event.target.value)}
                        placeholder="https://..."
                        aria-invalid={!isAllowedSiteUrl(siteUrl)}
                    />
                </div>
            </div>

            <div className="uk-margin">
                <label className="uk-form-label" htmlFor="repoUrl">{t('project.repo_label')}</label>
                <div className="uk-form-controls">
                    <input
                        className="uk-input"
                        id="repoUrl"
                        type="url"
                        value={repoUrl}
                        onChange={(event) => setRepoUrl(event.target.value)}
                        placeholder="https://github.com/..."
                        aria-invalid={!isAllowedRepoUrl(repoUrl)}
                    />
                </div>
                <p className="uk-text-meta">
                    {isAllowedRepoUrl(repoUrl)
                        ? `${t('project.repo_hint')} ${REPO_HOSTS.join(', ')}`
                        : t('project.error.repo_url')}
                </p>
            </div>

            <TagsField
                all={tags}
                label={t('project.tags_label')}
                value={{ tagIds: selectedTagIds, newTags }}
                onChange={(next) => { setSelectedTagIds(next.tagIds); setNewTags(next.newTags); }}
            />

            <div className="uk-margin">
                <label className="uk-form-label" htmlFor="content">{t('project.content_label')}</label>
                <div className="uk-form-controls">
                    <ArticleEditor value={content} onChange={setContent} />
                </div>
            </div>

            <div className="uk-margin">
                {shown && <p className="zx-form-error">{shown}</p>}
                <button className="uk-button uk-button-primary" type="submit" disabled={submitting}>
                    {submitting ? t('project.saving') : t(creating ? 'project.create_submit' : 'project.save_submit')}
                </button>
                {initial && (
                    <Link className="uk-button uk-button-default uk-margin-small-left" to={`/portfolio/${initial.slug}`}>
                        {t('project.see_it')}
                    </Link>
                )}
            </div>
        </form>
    );
};

export default ProjectForm;
