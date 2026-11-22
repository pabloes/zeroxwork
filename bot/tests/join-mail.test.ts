import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    accountAgeDays,
    recipientFromEnv,
    renderJoinMail,
    sendJoinMail,
    smtpFromEnv,
    type JoinedMember,
} from '../src/join-mail.js';

const { mail } = vi.hoisted(() => ({
    mail: { calls: [] as any[], fail: null as Error | null },
}));

vi.mock('nodemailer', () => ({
    default: {
        createTransport: (options: any) => ({
            sendMail: async (message: any) => {
                mail.calls.push({ options, message });
                if (mail.fail) throw mail.fail;
                return { messageId: 'test' };
            },
        }),
    },
}));

const NOW = new Date('2026-11-22T12:00:00Z');

function member(overrides: Partial<JoinedMember> = {}): JoinedMember {
    return {
        tag: 'nuevovecino',
        id: '216789012345678901',
        guildName: 'ZEROxWORK',
        accountCreatedAt: new Date('2026-11-20T12:00:00Z'),
        joinedAt: new Date('2026-11-22T11:59:00Z'),
        memberCount: 412,
        linked: false,
        ...overrides,
    };
}

function smtpEnv(): void {
    vi.stubEnv('ADMIN_NOTIFY_EMAIL', 'pablo@example.com');
    vi.stubEnv('SMTP_HOST', 'smtp.example.com');
    vi.stubEnv('SMTP_PORT', '465');
    vi.stubEnv('SMTP_SECURE', 'true');
    vi.stubEnv('SMTP_USER', 'no-reply@example.com');
    vi.stubEnv('SMTP_PASS', 'secret');
}

beforeEach(() => {
    mail.calls.length = 0;
    mail.fail = null;
});

afterEach(() => {
    vi.unstubAllEnvs();
});

describe('the mail itself', () => {
    it('names who joined in the subject', () => {
        expect(renderJoinMail(member(), NOW).subject).toBe('[ZEROxWORK] Nuevo miembro en Discord: nuevovecino');
    });

    it('keeps a username with a newline on one subject line', () => {
        const { subject } = renderJoinMail(member({ tag: 'uno\nSubject: otra cosa' }), NOW);
        expect(subject).not.toContain('\n');
    });

    it('escapes a username that tries to carry markup', () => {
        const { html } = renderJoinMail(member({ tag: '<img src=x onerror=alert(1)>' }), NOW);
        expect(html).not.toContain('<img');
        expect(html).toContain('&lt;img');
    });

    it('says whether the ZEROxWORK account was already linked', () => {
        expect(renderJoinMail(member({ linked: false }), NOW).html).toContain('sin vincular');
        expect(renderJoinMail(member({ linked: true }), NOW).html).toContain('ya vinculada');
    });

    it('shows how old the Discord account is, so a throwaway stands out', () => {
        expect(renderJoinMail(member(), NOW).html).toContain('hace 2 días');
        expect(renderJoinMail(member({ accountCreatedAt: new Date('2026-11-21T12:00:00Z') }), NOW).html)
            .toContain('hace 1 día');
    });

    it('still sends when Discord gave no dates or count', () => {
        const { html } = renderJoinMail(member({ accountCreatedAt: null, joinedAt: null, memberCount: null }), NOW);
        expect(html).toContain('desconocida');
        expect(html).not.toContain('Miembros en el servidor');
    });

    it('links to the profile', () => {
        expect(renderJoinMail(member(), NOW).html).toContain('https://discord.com/users/216789012345678901');
    });

    it('reads a date it cannot place as unknown rather than as a negative age', () => {
        expect(accountAgeDays(new Date('2026-11-23T12:00:00Z'), NOW)).toBeNull();
        expect(accountAgeDays(null, NOW)).toBeNull();
    });
});

describe('settings', () => {
    it('takes the recipient only when it is really there', () => {
        expect(recipientFromEnv({ ADMIN_NOTIFY_EMAIL: ' pablo@example.com ' })).toBe('pablo@example.com');
        expect(recipientFromEnv({ ADMIN_NOTIFY_EMAIL: '   ' })).toBeNull();
        expect(recipientFromEnv({})).toBeNull();
    });

    it('needs the server, the user and the password; the port defaults to 587', () => {
        expect(smtpFromEnv({ SMTP_HOST: 'h', SMTP_USER: 'u' })).toBeNull();
        expect(smtpFromEnv({ SMTP_USER: 'u', SMTP_PASS: 'p' })).toBeNull();
        expect(smtpFromEnv({ SMTP_HOST: 'h', SMTP_USER: 'u', SMTP_PASS: 'p' }))
            .toEqual({ host: 'h', port: 587, secure: false, user: 'u', pass: 'p' });
        expect(smtpFromEnv({ SMTP_HOST: 'h', SMTP_USER: 'u', SMTP_PASS: 'p', SMTP_PORT: '465', SMTP_SECURE: 'true' }))
            .toMatchObject({ port: 465, secure: true });
    });
});

describe('sending', () => {
    it('sends the notice to the configured mailbox', async () => {
        smtpEnv();
        await expect(sendJoinMail(member())).resolves.toBe('sent');
        expect(mail.calls).toHaveLength(1);
        expect(mail.calls[0].message.to).toBe('pablo@example.com');
        expect(mail.calls[0].message.subject).toContain('nuevovecino');
        expect(mail.calls[0].options).toMatchObject({ host: 'smtp.example.com', port: 465, secure: true });
    });

    it('does nothing, and says so, when no recipient is configured', async () => {
        smtpEnv();
        vi.stubEnv('ADMIN_NOTIFY_EMAIL', undefined as unknown as string);

        const lines: string[] = [];
        await expect(sendJoinMail(member(), (line) => lines.push(line))).resolves.toBe('skipped');
        expect(mail.calls).toHaveLength(0);
        expect(lines.join(' ')).toContain('ADMIN_NOTIFY_EMAIL');
    });

    it('does nothing when the SMTP settings are missing', async () => {
        vi.stubEnv('ADMIN_NOTIFY_EMAIL', 'pablo@example.com');
        vi.stubEnv('SMTP_HOST', undefined as unknown as string);
        vi.stubEnv('SMTP_USER', undefined as unknown as string);
        vi.stubEnv('SMTP_PASS', undefined as unknown as string);

        const lines: string[] = [];
        await expect(sendJoinMail(member(), (line) => lines.push(line))).resolves.toBe('skipped');
        expect(mail.calls).toHaveLength(0);
        expect(lines.join(' ')).toContain('SMTP_HOST');
    });

    it('swallows an SMTP failure: the arrival still gets its roles', async () => {
        smtpEnv();
        mail.fail = new Error('connection refused');

        const lines: string[] = [];
        await expect(sendJoinMail(member(), (line) => lines.push(line))).resolves.toBe('failed');
        expect(lines.join(' ')).toContain('connection refused');
    });
});
