import { describe, it, expect } from 'vitest';
import { protect, restore, missingTokens } from '../src/services/markdown-protect.js';

const ARTICLE = [
    'Intro con una imagen:',
    '',
    '![Un gato](/api/images/user-uploaded-images/abc123.png)',
    '',
    'Y un [enlace](https://zeroxwork.com/blog "El blog") más `código inline`.',
    '',
    '```js',
    'const a = 1;',
    '```',
    '',
    '[iframe]',
].join('\n');

describe('protect', () => {
    it('hides image and link targets but leaves the prose alone', () => {
        const { text } = protect(ARTICLE);

        expect(text).not.toContain('/api/images/user-uploaded-images/abc123.png');
        expect(text).not.toContain('https://zeroxwork.com/blog');
        expect(text).toContain('Intro con una imagen:');
        expect(text).toContain('![Un gato]');
        expect(text).toContain('[enlace]');
    });

    it('hides code, raw html and the iframe marker', () => {
        const { text } = protect('`x` <b>y</b> [iframe]');

        expect(text).not.toContain('`x`');
        expect(text).not.toContain('<b>');
        expect(text).not.toContain('[iframe]');
    });

    it('is reversible when nothing is translated', () => {
        const { text, tokens } = protect(ARTICLE);
        expect(restore(text, tokens)).toBe(ARTICLE);
    });
});

describe('restore', () => {
    it('puts the fragments back after the prose changed', () => {
        const { text, tokens } = protect('Mira ![gato](/img/a.png) aquí');
        const translated = text.replace('Mira', 'Look at').replace('aquí', 'here');

        expect(restore(translated, tokens)).toBe('Look at ![gato](/img/a.png) here');
    });

    it('survives a translator that spaces out the token', () => {
        const { tokens } = protect('![gato](/img/a.png)');

        expect(restore('![chat]% % ZX 0 % %', tokens)).toBe('![chat](/img/a.png)');
    });

    it('leaves the text as-is when a token was dropped', () => {
        const { tokens } = protect('![gato](/img/a.png)');

        expect(restore('![cat]', tokens)).toBe('![cat]');
        expect(missingTokens('![cat]', tokens)).toEqual([0]);
    });
});

describe('missingTokens', () => {
    it('reports nothing when every token came back', () => {
        const { text, tokens } = protect(ARTICLE);
        expect(missingTokens(text, tokens)).toEqual([]);
    });
});

/**
 * A link whose visible text is the url itself. The bare-url pass runs last, over
 * text that already holds tokens, and used to eat the `]` and the token behind
 * it — so the article shipped a literal `%%ZX1%%` to every reader and the dropped
 * -fragment warning fired for tokens that had never left.
 */
describe('a link written as [url](url)', () => {
    const SELF_LINKED = 'Regístrate en **[https://zeroxwork.com/register](https://zeroxwork.com/register)**.';

    it('does not bury one token inside another', () => {
        const { tokens } = protect(SELF_LINKED);

        for (const original of tokens) {
            expect(original).not.toContain('%%ZX');
        }
    });

    it('survives the round trip untouched', () => {
        const { text, tokens } = protect(SELF_LINKED);
        expect(restore(text, tokens)).toBe(SELF_LINKED);
    });

    it('leaves no token residue after a translation', () => {
        const { text, tokens } = protect(SELF_LINKED);
        const translated = text.replace('Regístrate en', 'Start by creating an account at');
        const restored = restore(translated, tokens);

        expect(restored).not.toContain('%%ZX');
        expect(restored).toBe(
            'Start by creating an account at **[https://zeroxwork.com/register](https://zeroxwork.com/register)**.',
        );
        expect(missingTokens(translated, tokens)).toEqual([]);
    });

    it('still protects a bare url in prose', () => {
        const { text, tokens } = protect('Visita https://zeroxwork.com y mira.');

        expect(text).not.toContain('zeroxwork.com');
        expect(restore(text, tokens)).toBe('Visita https://zeroxwork.com y mira.');
    });

    it('restores a container before the tokens hidden in it', () => {
        // Hand-built nesting: whatever produces it, restore must cope.
        expect(restore('%%ZX1%%', ['/img/a.png', '![gato](%%ZX0%%)'])).toBe('![gato](/img/a.png)');
    });
});
