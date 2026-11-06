/**
 * DeepL receives article bodies as plain text, so anything that is syntax
 * rather than prose (image and link targets, code, the [iframe] marker) comes
 * back translated or reflowed, which breaks the article in every language.
 *
 * protect() swaps those fragments for opaque tokens before translating and
 * restore() puts them back afterwards. Tokens are deliberately ugly so no
 * translation engine treats them as words.
 */

const TOKEN_PREFIX = '%%ZX';
const TOKEN_SUFFIX = '%%';

// Order matters: code fences first, so their contents are not matched again
const PATTERNS: RegExp[] = [
    /```[\s\S]*?```/g,          // fenced code blocks
    /`[^`\n]+`/g,               // inline code
    /\[iframe\]/g,              // embed marker used by the article view
    /(?<=\])\([^)\s]*(?:\s+"[^"]*")?\)/g, // link and image targets, keeping the visible [text]
    /<[^>\s][^>]*>/g,           // raw html tags
    /https?:\/\/[^\s)]+/g,      // bare urls
];

export interface ProtectedText {
    text: string;
    tokens: string[];
}

export function protect(input: string): ProtectedText {
    const tokens: string[] = [];
    let text = input;

    for (const pattern of PATTERNS) {
        text = text.replace(pattern, (match) => {
            const token = `${TOKEN_PREFIX}${tokens.length}${TOKEN_SUFFIX}`;
            tokens.push(match);
            return token;
        });
    }

    return { text, tokens };
}

export function restore(translated: string, tokens: string[]): string {
    let text = translated;

    tokens.forEach((original, index) => {
        const token = `${TOKEN_PREFIX}${index}${TOKEN_SUFFIX}`;
        // translators sometimes add spaces inside the token or change its case
        const loose = new RegExp(`%\\s*%\\s*ZX\\s*${index}\\s*%\\s*%`, 'gi');
        text = text.includes(token)
            ? text.split(token).join(original)
            : text.replace(loose, original);
    });

    return text;
}

/** Tokens the translator dropped, so callers can log what came back damaged. */
export function missingTokens(translated: string, tokens: string[]): number[] {
    return tokens
        .map((_, index) => index)
        .filter((index) => {
            const loose = new RegExp(`%\\s*%\\s*ZX\\s*${index}\\s*%\\s*%`, 'i');
            return !loose.test(translated);
        });
}
