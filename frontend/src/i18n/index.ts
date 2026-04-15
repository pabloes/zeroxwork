import { createContext, useContext } from 'react';
import en from './en.json';
import es from './es.json';
import ptBr from './pt-br.json';
import zh from './zh.json';

export const SUPPORTED_LANGS = ['en', 'es', 'pt-br', 'zh'] as const;
export type SupportedLang = typeof SUPPORTED_LANGS[number];

const dictionaries: Record<SupportedLang, Record<string, string>> = {
    en,
    es,
    'pt-br': ptBr,
    zh,
};

/**
 * Detect initial language:
 * 1. localStorage "lang" if valid
 * 2. navigator.language normalized to base code
 * 3. fallback "en"
 */
export function getInitialLanguage(): SupportedLang {
    const saved = localStorage.getItem('lang');
    if (saved && SUPPORTED_LANGS.includes(saved as SupportedLang)) {
        return saved as SupportedLang;
    }

    const browserLangs = navigator.languages?.length ? navigator.languages : [navigator.language];
    for (const raw of browserLangs) {
        const lower = raw.toLowerCase();
        // Map any Portuguese variant to pt-br
        if (lower === 'pt' || lower.startsWith('pt-')) return 'pt-br';
        // Map any Chinese variant to zh
        if (lower === 'zh' || lower.startsWith('zh-')) return 'zh';
        const base = lower.split('-')[0];
        if (SUPPORTED_LANGS.includes(base as SupportedLang)) {
            return base as SupportedLang;
        }
    }

    return 'en';
}

/**
 * Translate a key using the given language.
 * Falls back to English, then returns the key itself.
 */
export function translate(lang: SupportedLang, key: string): string {
    return dictionaries[lang]?.[key] ?? dictionaries.en[key] ?? key;
}

// --- React context ---

export interface LanguageContextValue {
    lang: SupportedLang;
    setLanguage: (lang: SupportedLang) => void;
    t: (key: string) => string;
}

export const LanguageContext = createContext<LanguageContextValue>({
    lang: 'en',
    setLanguage: () => {},
    t: (key) => key,
});

export function useTranslation() {
    return useContext(LanguageContext);
}
