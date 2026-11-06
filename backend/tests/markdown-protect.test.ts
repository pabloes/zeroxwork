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
