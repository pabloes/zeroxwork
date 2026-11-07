import React from 'react';
import { useTranslation } from '../i18n';
import { videoEmbedUrl } from '../services/project-media';

interface Props {
    title: string;
    screenshots?: string[] | null;
    videoUrl?: string | null;
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
        <section className="zx-gallery" aria-label={t('project.gallery')}>
            {embed && (
                <div className="zx-video-frame">
                    <iframe
                        src={embed}
                        title={`${title} — ${t('project.video')}`}
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
                <div className="zx-shot-grid" uk-lightbox="">
                    {shots.map((url, index) => (
                        <a key={url} href={url} data-caption={`${title} (${index + 1}/${shots.length})`}>
                            <img src={url} alt={`${title} (${index + 1})`} loading="lazy" />
                        </a>
                    ))}
                </div>
            )}
        </section>
    );
};

export default ProjectGallery;
