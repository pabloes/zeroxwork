import React, { useState } from 'react';
import ImagePicker from './ImagePicker';
import { useTranslation } from '../../i18n';
import {
    SCREENSHOTS_MAX,
    SCREENSHOTS_MIN,
    VIDEO_HOSTS,
    isAllowedVideoUrl,
    videoEmbedUrl,
} from '../../services/project-media';

interface Props {
    screenshots: string[];
    onScreenshotsChange: (next: string[]) => void;
    videoUrl: string;
    onVideoUrlChange: (next: string) => void;
}

/**
 * The gallery side of a project: the screenshots in the order they will be
 * shown, and one optional video link.
 *
 * Only rendered for the project category. The order matters, so the shots can
 * be moved rather than only added and removed -- re-uploading four images to
 * fix the order is the kind of thing that stops people filling this in.
 */
const ProjectMediaField: React.FC<Props> = ({
    screenshots,
    onScreenshotsChange,
    videoUrl,
    onVideoUrlChange,
}) => {
    const { t } = useTranslation();
    const [pickerOpen, setPickerOpen] = useState(false);

    const full = screenshots.length >= SCREENSHOTS_MAX;
    const short = screenshots.length < SCREENSHOTS_MIN;
    const videoOk = isAllowedVideoUrl(videoUrl);
    const embed = videoEmbedUrl(videoUrl);

    const add = (url: string) => {
        setPickerOpen(false);
        if (full || screenshots.includes(url)) return;
        onScreenshotsChange([...screenshots, url]);
    };

    const remove = (index: number) => {
        onScreenshotsChange(screenshots.filter((_, i) => i !== index));
    };

    const move = (index: number, by: -1 | 1) => {
        const target = index + by;
        if (target < 0 || target >= screenshots.length) return;
        const next = [...screenshots];
        [next[index], next[target]] = [next[target], next[index]];
        onScreenshotsChange(next);
    };

    return (
        <div className="uk-margin zx-project-media">
            <label className="uk-form-label">{t('project.screenshots')}</label>

            <p className="uk-text-meta zx-shot-count">
                {`${screenshots.length} / ${SCREENSHOTS_MIN}–${SCREENSHOTS_MAX}`}
                {' · '}
                {short ? t('project.screenshots_need_more') : t('project.screenshots_enough')}
            </p>

            {screenshots.length > 0 && (
                <ul className="zx-shot-rows">
                    {screenshots.map((url, index) => (
                        <li key={url} className="zx-shot">
                            <img src={url} alt="" />
                            <div className="zx-shot-tools">
                                <button
                                    type="button"
                                    className="zx-icon-btn"
                                    onClick={() => move(index, -1)}
                                    disabled={index === 0}
                                    aria-label={t('project.screenshot_earlier')}
                                >←</button>
                                <button
                                    type="button"
                                    className="zx-icon-btn"
                                    onClick={() => move(index, 1)}
                                    disabled={index === screenshots.length - 1}
                                    aria-label={t('project.screenshot_later')}
                                >→</button>
                                <button
                                    type="button"
                                    className="zx-icon-btn"
                                    onClick={() => remove(index)}
                                    aria-label={t('project.screenshot_remove')}
                                >✕</button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            <button
                type="button"
                className="zx-tb-text"
                onClick={() => setPickerOpen(true)}
                disabled={full}
            >
                {full ? t('project.screenshots_full') : t('project.screenshot_add')}
            </button>

            {pickerOpen && (
                <ImagePicker onClose={() => setPickerOpen(false)} onSelect={add} />
            )}

            <label className="uk-form-label uk-margin-top" htmlFor="videoUrl">
                {t('project.video')}
            </label>
            <div className="uk-form-controls">
                <input
                    className="uk-input"
                    id="videoUrl"
                    type="url"
                    value={videoUrl}
                    onChange={(e) => onVideoUrlChange(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    aria-invalid={!videoOk}
                />
            </div>
            <p className="uk-text-meta">
                {videoOk ? `${t('project.video_hint')} ${VIDEO_HOSTS.join(', ')}` : t('project.video_bad_host')}
            </p>

            {embed && (
                <div className="zx-video-frame">
                    <iframe
                        src={embed}
                        title={t('project.video')}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
                        allowFullScreen
                        loading="lazy"
                    />
                </div>
            )}
        </div>
    );
};

export default ProjectMediaField;
