// Utility function to sanitize file names
export function sanitizeFileName(filename: string): string {
    return filename.replace(/[^a-zA-Z0-9.\-_]/g, '_');
}
