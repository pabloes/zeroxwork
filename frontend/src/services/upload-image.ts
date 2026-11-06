import { api } from "./axios-setup";

export interface UploadedImage {
    sha256: string;
    fileName: string;
    /** same-origin path, ready to drop into markdown */
    url: string;
    banned?: boolean;
}

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'];

export class UploadError extends Error {}

/**
 * Uploads one image and returns its public URL. Same endpoint the image page
 * uses; this one just hands the result back instead of navigating away.
 */
export async function uploadImage(file: File): Promise<UploadedImage> {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        throw new UploadError('unsupported-type');
    }
    if (file.size > MAX_IMAGE_BYTES) {
        throw new UploadError('too-large');
    }

    const formData = new FormData();
    formData.append('image', file);

    try {
        const { data } = await api.post('/images/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });

        if (data.banned) {
            throw new UploadError('rejected');
        }

        return {
            sha256: data.sha256,
            fileName: data.fileName,
            // older deployments only return the hash
            url: data.url ?? `/api/images/user-uploaded-images/${data.fileName ?? data.sha256}`,
            banned: data.banned,
        };
    } catch (error: any) {
        if (error instanceof UploadError) throw error;
        if (error.response?.status === 429) throw new UploadError('rate-limited');
        if (error.response?.status === 401) throw new UploadError('unauthorized');
        if (error.response?.status === 400) throw new UploadError('unsupported-type');
        // the reason is for the console; the UI shows a translated generic message
        console.error('Image upload failed:', error.response?.data?.message ?? error.message);
        throw new UploadError('failed');
    }
}

export function imageFromDataTransfer(items: DataTransferItemList | null): File[] {
    if (!items) return [];
    return Array.from(items)
        .filter(item => item.kind === 'file' && item.type.startsWith('image/'))
        .map(item => item.getAsFile())
        .filter((file): file is File => file !== null);
}
