import { describe, it, expect } from 'vitest';
import { getIframeSandbox, TRUSTED_EMBED_ORIGINS } from '../../frontend/src/utils/iframe-sandbox.js';

const FULL = 'allow-scripts allow-same-origin allow-forms allow-popups';
const RESTRICTED = 'allow-scripts';

describe('iframe sandbox policy', () => {
    it('exports a non-empty trusted origins list', () => {
        expect(TRUSTED_EMBED_ORIGINS.length).toBeGreaterThan(0);
    });

    it('grants full sandbox to internal paths', () => {
        expect(getIframeSandbox('/embeds/my-tool/')).toBe(FULL);
        expect(getIframeSandbox('/anything')).toBe(FULL);
    });

    it('grants full sandbox to trusted origins', () => {
        expect(getIframeSandbox('https://pabloes.github.io/aave-vault-dapp/')).toBe(FULL);
    });

    it('restricts untrusted origins', () => {
        expect(getIframeSandbox('https://evil.com/app')).toBe(RESTRICTED);
        expect(getIframeSandbox('https://other.github.io/tool')).toBe(RESTRICTED);
    });

    it('restricts invalid URLs', () => {
        expect(getIframeSandbox('not-a-url')).toBe(RESTRICTED);
    });
});
