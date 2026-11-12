/**
 * The mails the account system sends, and the links inside them.
 *
 * The token rides in the fragment (`#token=`), not the query string. A
 * fragment never leaves the browser: it is not in our request log, not in a
 * proxy's, and not in the address a page reports to analytics once the page
 * has taken it out.
 *
 * English only for now: it is the site's first language, and the account does
 * not record which one its owner reads.
 */
import { SITE_URL } from '../config/site.js';
import { sendMail } from './mailer.js';

export function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function linkWithToken(path: string, token: string): string {
    return `${SITE_URL}${path}#token=${encodeURIComponent(token)}`;
}

/** Enough to recognise an address, not enough to learn it from a forwarded mail. */
export function maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain) return '***';
    const shown = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
    return `${shown}***@${domain}`;
}

export interface Mail {
    subject: string;
    html: string;
}

function button(url: string, label: string): string {
    const safe = escapeHtml(url);
    return `<p><a href="${safe}">${escapeHtml(label)}</a></p>
<p>If the link does not open, copy this address into your browser:<br>${safe}</p>`;
}

export function verificationMail(token: string): Mail {
    return {
        subject: 'ZEROxWORK email verification',
        html: `<p>Confirm this address to finish creating your ZEROxWORK account. The link is valid for 6 hours.</p>
${button(linkWithToken('/verify', token), 'Verify email')}`,
    };
}

export function passwordResetMail(token: string): Mail {
    return {
        subject: 'Choose a new ZEROxWORK password',
        html: `<p>Somebody asked to choose a new password for the ZEROxWORK account with this address. The link is valid for 30 minutes and works once.</p>
${button(linkWithToken('/reset-password', token), 'Choose a new password')}
<p>If it was not you, ignore this mail: your password stays as it is.</p>`,
    };
}

export function passwordChangedMail(): Mail {
    return {
        subject: 'Your ZEROxWORK password was changed',
        html: `<p>The password of your ZEROxWORK account was just changed, and every other device was signed out.</p>
<p>If it was not you, choose a new one now: ${escapeHtml(`${SITE_URL}/forgot-password`)}</p>`,
    };
}

export function emailChangeMail(token: string): Mail {
    return {
        subject: 'Confirm your new ZEROxWORK email',
        html: `<p>Somebody asked to use this address for their ZEROxWORK account. Open the link to confirm it; it is valid for 1 hour and works once.</p>
${button(linkWithToken('/confirm-email', token), 'Use this email')}
<p>If it was not you, ignore this mail: nothing changes.</p>`,
    };
}

export function emailChangedNotice(newEmail: string): Mail {
    return {
        subject: 'The email of your ZEROxWORK account was changed',
        html: `<p>Your ZEROxWORK account now signs in with ${escapeHtml(maskEmail(newEmail))} instead of this address.</p>
<p>If it was not you, tell an admin as soon as you can: this address can no longer reset the password.</p>`,
    };
}

export async function deliver(to: string, mail: Mail): Promise<void> {
    await sendMail(to, mail.subject, mail.html);
}
