import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { LanguageContext, getInitialLanguage, htmlLang, translate, type SupportedLang } from './index';

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [lang, setLangState] = useState<SupportedLang>(getInitialLanguage);

    // keep the document in sync: lang attribute, title and description
    useEffect(() => {
        document.documentElement.lang = htmlLang(lang);
        document.title = translate(lang, 'meta.title');
        document.querySelector('meta[name="description"]')?.setAttribute('content', translate(lang, 'meta.description'));
    }, [lang]);

    const setLanguage = useCallback((newLang: SupportedLang) => {
        localStorage.setItem('lang', newLang);
        setLangState(newLang);
        // Keep blogLang in sync for article translation system
        localStorage.setItem('blogLang', newLang);
        window.dispatchEvent(new CustomEvent('langChange', { detail: newLang }));
    }, []);

    const t = useCallback((key: string) => translate(lang, key), [lang]);

    const value = useMemo(() => ({ lang, setLanguage, t }), [lang, setLanguage, t]);

    return (
        <LanguageContext.Provider value={value}>
            {children}
        </LanguageContext.Provider>
    );
};
