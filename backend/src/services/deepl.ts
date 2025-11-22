const DEEPL_API_URL = 'https://api-free.deepl.com/v2/translate';

export const SUPPORTED_LANGS = ['PT-BR', 'ZH', 'EN', 'ES'] as const;
export type SupportedLang = typeof SUPPORTED_LANGS[number];

/**
 * Map internal lang codes to DeepL API codes
 */
export function toDeepLLang(lang: string): string {
    const upper = lang.toUpperCase();
    // DeepL uses specific codes
    const mapping: Record<string, string> = {
        'PT-BR': 'PT-BR',
        'ZH': 'ZH',
        'EN': 'EN',
        'ES': 'ES',
    };
    return mapping[upper] || upper;
}

/**
 * Normalize lang code to our internal format
 */
export function normalizeLang(lang: string): string {
    return lang.toLowerCase().replace('_', '-');
}

/**
 * Translate text using DeepL API
 */
export async function translateText(
    text: string,
    targetLang: string
): Promise<string> {
    const apiKey = process.env.DEEPL_API_KEY;

    if (!apiKey) {
        throw new Error('DEEPL_API_KEY not configured');
    }

    const response = await fetch(DEEPL_API_URL, {
        method: 'POST',
        headers: {
            'Authorization': `DeepL-Auth-Key ${apiKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            text: text,
            target_lang: toDeepLLang(targetLang),
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`DeepL API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.translations[0].text;
}

/**
 * Translate title and content
 */
export async function translateArticle(
    title: string,
    content: string,
    targetLang: string
): Promise<{ title: string; content: string }> {
    const [translatedTitle, translatedContent] = await Promise.all([
        translateText(title, targetLang),
        translateText(content, targetLang),
    ]);

    return {
        title: translatedTitle,
        content: translatedContent,
    };
}

/**
 * Get target languages excluding the source language
 */
export function getTargetLangs(sourceLang: string): SupportedLang[] {
    const normalized = sourceLang.toUpperCase();
    return SUPPORTED_LANGS.filter(lang => lang !== normalized);
}
