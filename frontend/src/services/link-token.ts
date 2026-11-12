/**
 * The one-use token of an email link: /verify, /reset-password, /confirm-email.
 *
 * It never stays in the address. An inline script in index.html lifts it out
 * before anything else runs -- analytics and ads report the page URL, and the
 * history would keep it -- and leaves it on `window.__zxLinkToken`, tagged
 * with the path it arrived on.
 */
declare global {
    interface Window {
        __zxLinkToken?: { path: string; token: string };
    }
}

/**
 * The token that came with the link for `path`, or null.
 *
 * Reading does not clear it: React StrictMode runs effects twice in
 * development, and the second run has to find the same token as the first.
 */
export function takeLinkToken(path: string): string | null {
    const stashed = window.__zxLinkToken;
    if (stashed && stashed.path === path) return stashed.token;

    // Reached without a page load (client-side navigation), so index.html never
    // saw this address. Fragment first: that is where the links carry it now;
    // the query is what older verification mails used.
    const fromHash = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('token');
    if (fromHash) return fromHash;

    return new URLSearchParams(window.location.search).get('token') || null;
}
