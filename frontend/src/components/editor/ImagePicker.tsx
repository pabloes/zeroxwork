import { useRef, useState } from 'react';
import { useQuery } from "@tanstack/react-query";
import { api } from "../../services/axios-setup";
import { useTranslation } from "../../i18n";
import { ACCEPTED_IMAGE_TYPES, uploadImage, UploadError } from "../../services/upload-image";

interface StoredImage {
    id: number;
    fileName: string;
    fileUrl: string;
    dangerous: boolean;
}

interface Props {
    onSelect: (url: string) => void;
    onClose: () => void;
}

/** Pick one of your uploaded images, or upload a new one on the spot. */
const ImagePicker: React.FC<Props> = ({ onSelect, onClose }) => {
    const { t } = useTranslation();
    const fileInput = useRef<HTMLInputElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);

    const { data: images = [], isLoading, refetch } = useQuery<StoredImage[]>({
        queryKey: ['my-images'],
        queryFn: async () => (await api.get('/images/get-all')).data,
    });

    const handleFile = async (file: File) => {
        setError(null);
        setUploading(true);
        try {
            const uploaded = await uploadImage(file);
            await refetch();
            onSelect(uploaded.url);
        } catch (e) {
            setError(t(`editor.error.${e instanceof UploadError ? e.message : 'failed'}`));
        } finally {
            setUploading(false);
        }
    };

    // the API returns absolute URLs; keep articles on same-origin paths
    const toPath = (fileUrl: string) => {
        try {
            return new URL(fileUrl).pathname;
        } catch {
            return fileUrl;
        }
    };

    return (
        <div className="zx-modal" role="dialog" aria-modal="true" aria-label={t('editor.image_from_library')}>
            <div className="zx-modal-backdrop" onClick={onClose} />
            <div className="zx-modal-box">
                <div className="zx-modal-head">
                    <h3>{t('editor.image_from_library')}</h3>
                    <button type="button" className="zx-icon-btn" onClick={onClose} aria-label={t('editor.close')}>✕</button>
                </div>

                <div className="zx-modal-actions">
                    <button
                        type="button"
                        className="zx-btn zx-btn-ghost"
                        onClick={() => fileInput.current?.click()}
                        disabled={uploading}
                    >
                        {uploading ? t('editor.uploading') : t('editor.image_from_device')}
                    </button>
                    <input
                        ref={fileInput}
                        type="file"
                        accept={ACCEPTED_IMAGE_TYPES.join(',')}
                        hidden
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            e.target.value = '';
                            if (file) handleFile(file);
                        }}
                    />
                </div>

                {error && <p className="zx-form-error">{error}</p>}

                {isLoading ? (
                    <p className="zx-empty">{t('common.loading')}</p>
                ) : images.length === 0 ? (
                    <p className="zx-empty">{t('editor.library_empty')}</p>
                ) : (
                    <div className="zx-picker-grid">
                        {images.filter(img => !img.dangerous).map(img => (
                            <button
                                type="button"
                                key={img.id}
                                className="zx-picker-item"
                                onClick={() => onSelect(toPath(img.fileUrl))}
                                title={img.fileName}
                            >
                                <img src={toPath(img.fileUrl)} alt="" loading="lazy" />
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ImagePicker;
