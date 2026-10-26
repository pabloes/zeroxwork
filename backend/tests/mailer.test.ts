import { describe, it, expect, beforeEach, vi } from 'vitest';

const sendMailMock = vi.fn();
const verifyMock = vi.fn();

vi.mock('nodemailer', () => ({
    default: { createTransport: () => ({ sendMail: sendMailMock, verify: verifyMock }) },
}));

async function loadMailer() {
    return await import('../src/services/mailer.js');
}

describe('sendMail', () => {
    beforeEach(() => {
        vi.resetModules();
        sendMailMock.mockReset();
        verifyMock.mockReset();
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('returns the transport info when the message is accepted', async () => {
        sendMailMock.mockResolvedValue({ messageId: '<abc@test>', accepted: ['a@b.c'], rejected: [] });
        const { sendMail } = await loadMailer();

        const info = await sendMail('a@b.c', 'subject', '<p>hi</p>');

        expect(info.messageId).toBe('<abc@test>');
    });

    // Regression: swallowing this error made /register answer "check your
    // email" while the verification mail was never delivered.
    it('throws MailDeliveryError instead of swallowing a delivery failure', async () => {
        const smtpError: any = new Error('certificate has expired');
        smtpError.code = 'ESOCKET';
        sendMailMock.mockRejectedValue(smtpError);
        const { sendMail, MailDeliveryError } = await loadMailer();

        await expect(sendMail('a@b.c', 'subject', '<p>hi</p>')).rejects.toThrow(MailDeliveryError);
    });

    it('keeps the SMTP code and reason on the thrown error', async () => {
        const smtpError: any = new Error('certificate has expired');
        smtpError.code = 'ESOCKET';
        smtpError.responseCode = 535;
        sendMailMock.mockRejectedValue(smtpError);
        const { sendMail } = await loadMailer();

        await expect(sendMail('a@b.c', 'subject', '<p>hi</p>')).rejects.toMatchObject({
            name: 'MailDeliveryError',
            code: 'ESOCKET',
            responseCode: 535,
            message: expect.stringContaining('certificate has expired'),
        });
    });
});

describe('verifySmtp', () => {
    beforeEach(() => {
        vi.resetModules();
        verifyMock.mockReset();
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('reports ok when the SMTP connection succeeds', async () => {
        verifyMock.mockResolvedValue(true);
        const { verifySmtp } = await loadMailer();

        await expect(verifySmtp()).resolves.toEqual({ ok: true });
    });

    it('reports the reason without throwing when the connection fails', async () => {
        const smtpError: any = new Error('certificate has expired');
        smtpError.code = 'ESOCKET';
        verifyMock.mockRejectedValue(smtpError);
        const { verifySmtp } = await loadMailer();

        await expect(verifySmtp()).resolves.toEqual({
            ok: false,
            error: 'certificate has expired',
            code: 'ESOCKET',
        });
    });
});

describe('getSmtpConfigSummary', () => {
    const ORIGINAL_ENV = { ...process.env };

    beforeEach(() => {
        vi.resetModules();
        process.env = { ...ORIGINAL_ENV };
    });

    it('never exposes the SMTP password', async () => {
        process.env.SMTP_PASS = 'super-secret';
        const { getSmtpConfigSummary } = await loadMailer();

        const summary = getSmtpConfigSummary();

        expect(summary.passConfigured).toBe(true);
        expect(JSON.stringify(summary)).not.toContain('super-secret');
    });
});
