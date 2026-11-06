import { describe, it, expect, beforeEach, vi } from 'vitest';

const sendMailMock = vi.fn();

vi.mock('nodemailer', () => ({
    default: { createTransport: () => ({ sendMail: sendMailMock, verify: vi.fn() }) },
}));

async function loadAdminNotify() {
    return await import('../src/services/admin-notify.js');
}

async function loadStore() {
    return await import('../src/services/log-store.js');
}

const ORIGINAL_ENV = { ...process.env };

describe('admin notifications', () => {
    beforeEach(() => {
        vi.resetModules();
        sendMailMock.mockReset();
        process.env = { ...ORIGINAL_ENV };
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('sends nothing when ADMIN_NOTIFY_EMAIL is unset or blank', async () => {
        delete process.env.ADMIN_NOTIFY_EMAIL;
        const { notifyAdminNewUser, notifyAdminNewArticle } = await loadAdminNotify();

        await notifyAdminNewUser('nuevo@user.com', new Date('2026-01-02T03:04:05.000Z'));
        process.env.ADMIN_NOTIFY_EMAIL = '   ';
        await notifyAdminNewArticle({
            title: 'Hola', author: 'pablo', category: 'News', lang: 'es', slug: 'hola',
        });

        expect(sendMailMock).not.toHaveBeenCalled();
    });

    it('leaves no error in the log buffer when the feature is off', async () => {
        delete process.env.ADMIN_NOTIFY_EMAIL;
        const { notifyAdminNewUser } = await loadAdminNotify();
        const { query, clear } = await loadStore();
        clear();

        await notifyAdminNewUser('nuevo@user.com', new Date());

        expect(query({ scope: 'admin-notify', level: 'error' }).total).toBe(0);
        expect(query({ scope: 'admin-notify', level: 'debug' }).total).toBe(1);
    });

    // A broken SMTP must not turn a successful registration into a 500: sendMail
    // throws MailDeliveryError on purpose, the admin notice has to absorb it.
    it('never rejects when delivery fails, and records the failure', async () => {
        process.env.ADMIN_NOTIFY_EMAIL = 'owner@zeroxwork.com';
        const smtpError: any = new Error('certificate has expired');
        smtpError.code = 'ESOCKET';
        sendMailMock.mockRejectedValue(smtpError);
        const { notifyAdminNewUser, notifyAdminNewArticle } = await loadAdminNotify();
        const { query, clear } = await loadStore();
        clear();

        await expect(notifyAdminNewUser('nuevo@user.com', new Date())).resolves.toBeUndefined();
        await expect(notifyAdminNewArticle({
            title: 'Hola', author: 'pablo', category: null, lang: 'es', slug: 'hola',
        })).resolves.toBeUndefined();

        const failures = query({ scope: 'admin-notify', level: 'error' });
        expect(failures.total).toBe(2);
        expect(failures.entries[0].message).toContain('certificate has expired');
    });

    it('sends greppable subjects to the configured address, without the verification link', async () => {
        process.env.ADMIN_NOTIFY_EMAIL = 'owner@zeroxwork.com';
        sendMailMock.mockResolvedValue({ messageId: '<abc@test>', accepted: ['owner@zeroxwork.com'], rejected: [] });
        const { notifyAdminNewUser, notifyAdminNewArticle } = await loadAdminNotify();

        await notifyAdminNewUser('nuevo@user.com', new Date('2026-01-02T03:04:05.000Z'));
        await notifyAdminNewArticle({
            title: 'Hola', author: 'pablo', category: 'News', lang: 'es', slug: 'hola-mundo',
        });

        const [signup, article] = sendMailMock.mock.calls.map(([options]) => options);

        expect(signup.to).toBe('owner@zeroxwork.com');
        expect(signup.subject).toBe('[ZEROxWORK] Nueva alta: nuevo@user.com');
        expect(signup.html).toContain('2026-01-02T03:04:05.000Z');
        expect(signup.html).not.toContain('/verify');

        expect(article.subject).toBe('[ZEROxWORK] Nuevo artículo: Hola');
        expect(article.html).toContain('https://zeroxwork.com/view-article/hola-mundo');
        expect(article.html).toContain('pablo');
        expect(article.html).toContain('News');
    });
});
