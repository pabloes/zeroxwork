import React from 'react';
import { useTranslation } from '../i18n';
import { videoEmbedUrl } from '../services/project-media';

interface Props {
    title: string;
    screenshots?: string[] | null;
    videoUrl?: string | null;
}

/**
 * How many columns the shots are laid out in. The count decides it, not the
 * author: three screenshots in a plain row leave a hole, and eight in two
 * columns turn into a long strip nobody scrolls. Three and eight also get a
 * wide opening shot, so the gallery starts with something to look at.
 */
function gridFor(count: number): string {
    if (count <= 3) return 'zx-gal-grid--3';
    if (count <= 6) return 'zx-gal-grid--6';
    return 'zx-gal-grid--8';
}

/**
 * What a project looks like: its video, if it has one, and its screenshots.
 *
 * Shown above the write-up, because someone deciding whether to read about a
 * project wants to see it first. Renders nothing at all when there is no media,
 * so it is safe on an article that predates the gallery.
 */
const ProjectGallery: React.FC<Props> = ({ title, screenshots, videoUrl }) => {
    const { t } = useTranslation();
    const shots = (screenshots ?? []).filter((url) => typeof url === 'string' && url !== '');
    const embed = videoEmbedUrl(videoUrl);

    if (shots.length === 0 && !videoUrl) return null;

    return (
        <section className="zx-gal" aria-label={t('project.gallery')}>
            <div className="zx-gal-head">
                <p className="zx-ficha-label" style={{ margin: 0 }}>{t('project.screenshots')}</p>
                <span className="zx-gal-count">
                    {/* Zero-padded so the number reads as a count, not a stray digit. */}
                    {String(shots.length).padStart(2, '0')}
                    {videoUrl ? ` ${t('project.plus_video')}` : ''}
                </span>
            </div>

            {embed && (
                <div className="zx-gal-video">
                    <iframe
                        src={embed}
                        title={`${title} — ${t('project.video_watch')}`}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
                        allowFullScreen
                        loading="lazy"
                    />
                </div>
            )}

            {/* A link we cannot embed is still a link worth offering. */}
            {!embed && videoUrl && (
                <p>
                    <a href={videoUrl} target="_blank" rel="noreferrer noopener">
                        {t('project.video_watch')}
                    </a>
                </p>
            )}

            {shots.length > 0 && (
                <div className={`zx-gal-grid ${gridFor(shots.length)}`} uk-lightbox="">
                    {shots.map((url, index) => (
                        <a
                            key={url}
                            className="zx-gal-item"
                            href={url}
                            data-caption={`${title} (${index + 1}/${shots.length})`}
                        >
                            <img src={url} alt={`${title} (${index + 1})`} loading="lazy" />
                            <span className="zx-gal-num">{String(index + 1).padStart(2, '0')}</span>
                        </a>
                    ))}
                </div>
            )}
        </section>
    );
};

export default ProjectGallery;
