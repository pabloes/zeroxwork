export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'zx-theme';

/** The theme applied by the boot script in index.html. */
export function getTheme(): Theme {
    return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

export function setTheme(theme: Theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try {
        localStorage.setItem(STORAGE_KEY, theme);
    } catch {
        // storage blocked: the theme still applies for this page view
    }
}
