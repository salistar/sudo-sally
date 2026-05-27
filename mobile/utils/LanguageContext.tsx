/**
 * Reactive language context.
 * Lets any screen read the current language and update it so that
 * EVERY screen re-renders with translated text instantly.
 */
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { I18nManager } from 'react-native';
import { storage } from './storage';
import { translations, isRTL as computeRTL, type Language } from './i18n';

type TranslationKey = keyof typeof translations.en;

interface LanguageContextValue {
  lang: Language;
  isRTL: boolean;
  setLang: (lang: Language) => Promise<void>;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'en',
  isRTL: false,
  setLang: async () => {},
  t: (key) => translations.en[key] ?? (key as string),
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>('en');

  // Load saved language on mount
  useEffect(() => {
    (async () => {
      try {
        const settings = await storage.getSettings();
        if (settings?.language) setLangState(settings.language);
      } catch {
        // ignore — keep default 'en'
      }
    })();
  }, []);

  const setLang = useCallback(async (next: Language) => {
    setLangState(next);
    try {
      I18nManager.allowRTL(computeRTL(next));
      // Note: full layout mirroring needs an app reload; text still flips per-string.
    } catch {}
    try {
      const settings = await storage.getSettings();
      await storage.setSettings({ ...settings, language: next });
    } catch {}
  }, []);

  const t = useCallback(
    (key: TranslationKey) => translations[lang][key] || translations.en[key] || (key as string),
    [lang],
  );

  return (
    <LanguageContext.Provider value={{ lang, isRTL: computeRTL(lang), setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLang = () => useContext(LanguageContext);
