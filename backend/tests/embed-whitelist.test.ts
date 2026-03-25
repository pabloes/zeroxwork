import { describe, it, expect } from 'vitest';
import { isEmbedUrlAllowed, EMBED_URL_WHITELIST } from '../src/config/embed.js';

describe('embed URL whitelist', () => {
    it('exports a non-empty whitelist', () => {
        expect(EMBED_URL_WHITELIST.length).toBeGreaterThan(0);
    });

    it('allows internal /embeds/ paths', () => {
        expect(isEmbedUrlAllowed('/embeds/my-tool/')).toBe(true);
        expect(isEmbedUrlAllowed('/embeds/aave-vault-dapp/')).toBe(true);
    });

    it('allows approved GitHub Pages origin', () => {
        expect(isEmbedUrlAllowed('https://pabloes.github.io/aave-vault-dapp/')).toBe(true);
        expect(isEmbedUrlAllowed('https://pabloes.github.io/other-tool/')).toBe(true);
    });

    it('rejects arbitrary external URLs', () => {
        expect(isEmbedUrlAllowed('https://evil.com/steal-tokens')).toBe(false);
        expect(isEmbedUrlAllowed('https://other.github.io/tool')).toBe(false);
        expect(isEmbedUrlAllowed('http://localhost:3000/embeds/')).toBe(false);
    });

    it('rejects URLs that look similar but do not match prefix', () => {
        expect(isEmbedUrlAllowed('/embed/no-trailing-s/')).toBe(false);
    });
});
