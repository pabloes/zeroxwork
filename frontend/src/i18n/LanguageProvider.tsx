import React, { useState, useCallback, useMemo } from 'react';
import { LanguageContext, getInitialLanguage, translate, type SupportedLang } from './index';

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [lang, setLangState] = useState<SupportedLang>(getInitialLanguage);

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
