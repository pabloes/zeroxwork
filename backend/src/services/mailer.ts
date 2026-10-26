import nodemailer from 'nodemailer';
import { record } from './log-store';

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true para 465, false para otros puertos
    auth: {
        user: process.env.SMTP_USER, // Tu usuario SMTP (por ejemplo, correo)
        pass: process.env.SMTP_PASS  // Tu contraseña SMTP
    }
});

/**
 * Thrown when the SMTP server did not accept the message, so callers can tell
 * a delivery failure apart from any other error (database, token, ...).
 */
export class MailDeliveryError extends Error {
    readonly code?: string;
    readonly responseCode?: number;

    constructor(message: string, cause?: any) {
        super(message);
        this.name = 'MailDeliveryError';
        this.code = cause?.code;
        this.responseCode = cause?.responseCode;
    }
}

// Función para enviar correos
export const sendMail = async (to: string, subject: string, html: string) => {
    const mailOptions = {
        from: `"No Reply" <${process.env.SMTP_USER}>`, // Dirección del remitente
        to, // Dirección del destinatario
        subject, // Asunto del correo
        html, // Contenido del correo en formato HTML
    };

    record('info', 'mail', `Enviando correo a ${to}`, { to, subject });

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Correo enviado: %s', info.messageId);
        record('info', 'mail', `Correo enviado a ${to}`, {
            to,
            subject,
            messageId: info.messageId,
            accepted: info.accepted,
            rejected: info.rejected,
            response: info.response,
        });
        return info;
    } catch (error: any) {
        console.error('Error enviando el correo:', error);
        record('error', 'mail', `Fallo al enviar correo a ${to}: ${error?.message ?? error}`, {
            to,
            subject,
            code: error?.code,
            command: error?.command,
            responseCode: error?.responseCode,
            response: error?.response,
        });
        // Callers must know: swallowing this is what made sign-up report
        // success while no verification mail was ever delivered.
        throw new MailDeliveryError(`Could not deliver mail to ${to}: ${error?.message ?? error}`, error);
    }
};

/** SMTP settings actually loaded by the process, without exposing the password. */
export const getSmtpConfigSummary = () => ({
    host: process.env.SMTP_HOST || null,
    port: process.env.SMTP_PORT || '587 (default)',
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || null,
    passConfigured: Boolean(process.env.SMTP_PASS),
});

/** Opens a connection to the SMTP server and authenticates, without sending anything. */
export const verifySmtp = async (): Promise<{ ok: boolean; error?: string; code?: string }> => {
    try {
        await transporter.verify();
        record('info', 'mail', 'SMTP verify OK');
        return { ok: true };
    } catch (error: any) {
        record('error', 'mail', `SMTP verify falló: ${error?.message ?? error}`, {
            code: error?.code,
            responseCode: error?.responseCode,
        });
        return { ok: false, error: error?.message ?? String(error), code: error?.code };
    }
};
