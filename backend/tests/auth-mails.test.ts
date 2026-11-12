import { describe, it, expect } from 'vitest';
import {
    emailChangeMail,
    emailChangedNotice,
    escapeHtml,
    linkWithToken,
    maskEmail,
    passwordResetMail,
    verificationMail,
} from '../src/services/auth-mails.js';

describe('links in mails', () => {
    it('carry the token in the fragment, which never reaches a server or its logs', () => {
        const url = new URL(linkWithToken('/reset-password', 'aaa.bbb.ccc'));
        expect(url.pathname).toBe('/reset-password');
        expect(url.search).toBe('');
        expect(url.hash).toBe('#token=aaa.bbb.ccc');
    });

    it.each([
        ['verification', verificationMail('tok'), '/verify#token=tok'],
        ['password reset', passwordResetMail('tok'), '/reset-password#token=tok'],
        ['email change', emailChangeMail('tok'), '/confirm-email#token=tok'],
    ])('the %s mail points at its own page', (_name, mail, link) => {
        expect(mail.html).toContain(link);
        expect(mail.html).not.toContain('?token=');
        expect(mail.subject).toContain('ZEROxWORK');
    });
});

describe('what goes into the HTML', () => {
    it('is escaped', () => {
        expect(escapeHtml(`<a href="x">'&`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;');
    });

    it('never spells out the new address to the old inbox', () => {
        const notice = emailChangedNotice('somebody.else@example.com');
        expect(notice.html).not.toContain('somebody.else@example.com');
        expect(notice.html).toContain('so***@example.com');
    });

    it('masks short addresses too', () => {
        expect(maskEmail('a@x.io')).toBe('a***@x.io');
        expect(maskEmail('ab@x.io')).toBe('a***@x.io');
        expect(maskEmail('not-an-address')).toBe('***');
    });
});
