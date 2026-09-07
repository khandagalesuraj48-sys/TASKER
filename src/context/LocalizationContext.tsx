import React, { createContext, useContext, useState, useEffect } from 'react';
import { SupportedLanguage, SUPPORTED_LANGUAGES, LanguageInfo } from '../types/localization';
import { getAppLanguage, setAppLanguage, t } from '../services/localizationService';

interface LocalizationContextType {
  language: SupportedLanguage;
  languages: LanguageInfo[];
  setLanguage: (lang: SupportedLanguage) => void;
  t: (key: string) => string;
}

const LocalizationContext = createContext<LocalizationContextType | undefined>(undefined);

export const LocalizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLangState] = useState<SupportedLanguage>(getAppLanguage());

  useEffect(() => {
    const handleLanguageChanged = (e: any) => {
      const newLang = e.detail?.language;
      if (newLang) setLangState(newLang);
    };

    window.addEventListener('language-changed', handleLanguageChanged);
    return () => window.removeEventListener('language-changed', handleLanguageChanged);
  }, []);

  const changeLanguage = (lang: SupportedLanguage) => {
    setAppLanguage(lang);
    setLangState(lang);
  };

  const translate = (key: string): string => {
    return t(key, language);
  };

  return (
    <LocalizationContext.Provider
      value={{
        language,
        languages: SUPPORTED_LANGUAGES,
        setLanguage: changeLanguage,
        t: translate,
      }}
    >
      {children}
    </LocalizationContext.Provider>
  );
};

export const useLocalization = (): LocalizationContextType => {
  const context = useContext(LocalizationContext);
  if (!context) {
    throw new Error('useLocalization must be used within a LocalizationProvider');
  }
  return context;
};
