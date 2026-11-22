import nodemailer, { type Transporter } from 'nodemailer';

/**
 * Mail to the owner every time somebody new joins the Discord server.
 *
 * Same rules as the website's admin notices (backend/src/services/admin-notify.ts):
 *  - Off by default: no `ADMIN_NOTIFY_EMAIL`, no mail, no error, one log line.
 *  - Never throws. A member joining must get their roles even if SMTP is down.
 *
 * Why its own mailer instead of importing the backend's: the bot image only
 * copies `backend/prisma` and `backend/src/constants`, and its node_modules is
 * its own. The settings are read from the same `SMTP_*` names the website uses,
 * so the bot's CapRover app takes the same values.
 */

/** What the mail talks about. Built from the Discord member, nothing fetched. */
export interface JoinedMember {
    /** `name#0000` or the plain username on the new naming */
    tag: string;
    id: string;
    guildName: string;
    /** when the Discord account itself was created: a brand new one is worth a look */
    accountCreatedAt: Date | null;
    joinedAt: Date | null;
    /** members in the server once this one is in, when Discord tells us */
    memberCount: number | null;
    /** whether they already had their ZEROxWORK account linked when they walked in */
    linked: boolean;
}

export interface SmtpSettings {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
}

export type JoinMailOutcome = 'sent' | 'skipped' | 'failed';

function escapeHtml(value: unknown): string {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** Usernames are user input: keep the subject on one line. */
function oneLine(value: unknown): string {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function stamp(value: Date | null): string {
    return value ? value.toISOString() : 'desconocida';
}

/** Days since the Discord account was created, for spotting throwaways. */
export function accountAgeDays(createdAt: Date | null, now: Date = new Date()): number | null {
    if (!createdAt) return null;
    const days = Math.floor((now.getTime() - createdAt.getTime()) / 86_400_000);
    return days >= 0 ? days : null;
}

/** Pure: the mail as it will be sent, so it can be read in a test. */
export function renderJoinMail(member: JoinedMember, now: Date = new Date()): { subject: string; html: string } {
    const age = accountAgeDays(member.accountCreatedAt, now);
    const ageLine = age === null
        ? 'desconocida'
        : `${escapeHtml(stamp(member.accountCreatedAt))} (hace ${age} ${age === 1 ? 'día' : 'días'})`;

    return {
        subject: `[ZEROxWORK] Nuevo miembro en Discord: ${oneLine(member.tag)}`,
        html: `<p>Alguien nuevo acaba de entrar en el Discord de ZEROxWORK.</p>
         <p><strong>Usuario:</strong> ${escapeHtml(member.tag)}<br>
         <strong>ID:</strong> ${escapeHtml(member.id)}<br>
         <strong>Servidor:</strong> ${escapeHtml(member.guildName)}<br>
         <strong>Ha entrado:</strong> ${escapeHtml(stamp(member.joinedAt))}<br>
         <strong>Cuenta de Discord creada:</strong> ${ageLine}<br>
         <strong>Cuenta de ZEROxWORK:</strong> ${member.linked ? 'ya vinculada' : 'sin vincular'}${
            member.memberCount === null ? '' : `<br>
         <strong>Miembros en el servidor:</strong> ${escapeHtml(member.memberCount)}`}</p>
         <p><a href="https://discord.com/users/${encodeURIComponent(member.id)}">Ver el perfil en Discord</a></p>`,
    };
}

/** Read per call, so the value is whatever the process has now. */
export function recipientFromEnv(env: NodeJS.ProcessEnv = process.env): string | null {
    const value = env.ADMIN_NOTIFY_EMAIL?.trim();
    return value ? value : null;
}

/** Null when the server, the user or the password is missing: nothing to send with. */
export function smtpFromEnv(env: NodeJS.ProcessEnv = process.env): SmtpSettings | null {
    const host = env.SMTP_HOST?.trim();
    const user = env.SMTP_USER?.trim();
    const pass = env.SMTP_PASS;
    if (!host || !user || !pass) return null;

    return {
        host,
        port: Number(env.SMTP_PORT?.trim() || '587'),
        secure: env.SMTP_SECURE?.trim() === 'true', // true para 465, false para el resto
        user,
        pass,
    };
}

let cached: { key: string; transporter: Transporter } | null = null;

/** One connection pool per set of settings, rebuilt if the settings change. */
function transporterFor(smtp: SmtpSettings): Transporter {
    const key = `${smtp.host}:${smtp.port}:${smtp.secure}:${smtp.user}`;
    if (cached?.key !== key) {
        cached = {
            key,
            transporter: nodemailer.createTransport({
                host: smtp.host,
                port: smtp.port,
                secure: smtp.secure,
                auth: { user: smtp.user, pass: smtp.pass },
            }),
        };
    }
    return cached.transporter;
}

/**
 * Sends the notice. Returns what happened instead of throwing: the caller is
 * the join handler, and roles matter more than the mail.
 */
export async function sendJoinMail(
    member: JoinedMember,
    log: (message: string) => void = console.log,
): Promise<JoinMailOutcome> {
    const to = recipientFromEnv();
    if (!to) {
        log('ADMIN_NOTIFY_EMAIL not set: no mail for the new member');
        return 'skipped';
    }

    const smtp = smtpFromEnv();
    if (!smtp) {
        log('SMTP_HOST, SMTP_USER or SMTP_PASS missing: no mail for the new member');
        return 'skipped';
    }

    const { subject, html } = renderJoinMail(member);

    try {
        await transporterFor(smtp).sendMail({
            from: `"No Reply" <${smtp.user}>`,
            to,
            subject,
            html,
        });
        return 'sent';
    } catch (error) {
        log(`New member mail failed for ${member.tag}: ${error instanceof Error ? error.message : 'unknown error'}`);
        return 'failed';
    }
}
