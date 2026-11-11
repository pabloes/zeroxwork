import { sendMail } from './mailer';
import { record } from './log-store';
import { SITE_URL } from '../config/site.js';

/**
 * Notices sent to the site owner when something happens on the site
 * (a sign-up, a new article), so it does not go unnoticed.
 *
 * Rules that matter here:
 *  - Off by default: no `ADMIN_NOTIFY_EMAIL`, no mail, no error, one debug line.
 *  - Never throws. `sendMail` deliberately throws `MailDeliveryError` so the
 *    verification mail failure is visible to the user, but an admin notice is
 *    not the user's problem: a broken SMTP must not turn a successful
 *    registration or article into a 500. Failures are recorded instead
 *    (scope `admin-notify`, visible through /api/logs).
 */


/** Read per call, so the value is whatever the process has now. */
function adminRecipient(): string | null {
    const value = process.env.ADMIN_NOTIFY_EMAIL;
    return value && value.trim() ? value.trim() : null;
}

function escapeHtml(value: unknown): string {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** Subjects come from user input (email, title): keep them on one line. */
function oneLine(value: unknown): string {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
}

async function notifyAdmin(subject: string, html: string, meta: Record<string, unknown>): Promise<void> {
    const to = adminRecipient();
    if (!to) {
        record('debug', 'admin-notify', 'ADMIN_NOTIFY_EMAIL not set: admin notice skipped', meta);
        return;
    }

    try {
        await sendMail(to, subject, html);
    } catch (error: any) {
        record('error', 'admin-notify', `Admin notice failed: ${error?.message ?? error}`, {
            ...meta,
            to,
            subject,
            code: error?.code,
            responseCode: error?.responseCode,
        });
    }
}

/**
 * A new account was created. Carries the email and the signup time only:
 * the verification link verifies that person's account, so it must never
 * travel to a third mailbox.
 */
export function notifyAdminNewUser(email: string, createdAt: Date | string): Promise<void> {
    const signedUpAt = createdAt instanceof Date ? createdAt.toISOString() : String(createdAt);

    return notifyAdmin(
        `[ZEROxWORK] Nueva alta: ${oneLine(email)}`,
        `<p>Nueva alta en ZEROxWORK.</p>
         <p><strong>Email:</strong> ${escapeHtml(email)}<br>
         <strong>Fecha:</strong> ${escapeHtml(signedUpAt)}</p>
         <p>La cuenta queda pendiente de verificar hasta que el usuario use su enlace.</p>`,
        { event: 'register', email }
    );
}

/** An article was published. */
export function notifyAdminNewArticle(article: {
    title: string;
    author: string;
    category: string | null;
    lang: string;
    slug: string;
}): Promise<void> {
    const url = `${SITE_URL}/view-article/${article.slug}`;

    return notifyAdmin(
        `[ZEROxWORK] Nuevo artículo: ${oneLine(article.title)}`,
        `<p>Nuevo artículo publicado en ZEROxWORK.</p>
         <p><strong>Título:</strong> ${escapeHtml(article.title)}<br>
         <strong>Autor:</strong> ${escapeHtml(article.author)}<br>
         <strong>Categoría:</strong> ${escapeHtml(article.category || 'sin categoría')}<br>
         <strong>Idioma:</strong> ${escapeHtml(article.lang)}</p>
         <p><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p>`,
        { event: 'article', slug: article.slug, lang: article.lang }
    );
}

/** A project was published. */
export function notifyAdminNewProject(project: {
    title: string;
    by: string;
    lang: string;
    slug: string;
}): Promise<void> {
    const url = `${SITE_URL}/portfolio/${project.slug}`;

    return notifyAdmin(
        `[ZEROxWORK] Nuevo proyecto: ${oneLine(project.title)}`,
        `<p>Nuevo proyecto publicado en el portfolio de ZEROxWORK.</p>
         <p><strong>Proyecto:</strong> ${escapeHtml(project.title)}<br>
         <strong>Lo ha dado de alta:</strong> ${escapeHtml(project.by)}<br>
         <strong>Idioma:</strong> ${escapeHtml(project.lang)}</p>
         <p><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p>`,
        { event: 'project', slug: project.slug, lang: project.lang }
    );
}
