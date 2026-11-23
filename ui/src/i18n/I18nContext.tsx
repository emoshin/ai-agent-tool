import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { en, type TranslationKey } from './en';
import { ru } from './ru';
import type { Locale, TranslationParams } from './types';

export type { Locale, TranslationKey, TranslationParams };

const LOCALE_STORAGE_KEY = 'ai_agent_ui_locale_v1';

const DICTIONARIES: Record<Locale, Record<TranslationKey, string>> = {
  en,
  ru,
};

export function loadStoredLocale(): Locale {
  try {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (saved === 'ru' || saved === 'en') {
      return saved;
    }
  } catch {
    // Ignore storage errors
  }
  return 'en';
}

export function saveStoredLocale(locale: Locale): void {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Ignore storage errors
  }
}

export function translate(locale: Locale, key: TranslationKey, params?: TranslationParams): string {
  const dict = DICTIONARIES[locale] ?? DICTIONARIES.en;
  let text = dict[key] ?? DICTIONARIES.en[key] ?? key;
  if (params) {
    for (const [paramKey, paramValue] of Object.entries(params)) {
      text = text.replaceAll(`{${paramKey}}`, String(paramValue));
    }
  }
  return text;
}

interface I18nContextValue {
  locale: Locale;
  dateLocale: string;
  setLocale: (next: Locale) => void;
  t: (key: TranslationKey, params?: TranslationParams) => string;
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'en',
  dateLocale: 'en-US',
  setLocale: () => {},
  t: (key, params) => translate('en', key, params),
});

export function I18nProvider({
  initialLocale,
  children,
}: {
  initialLocale?: Locale;
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(() => initialLocale ?? loadStoredLocale());

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    saveStoredLocale(next);
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const t = useCallback(
    (key: TranslationKey, params?: TranslationParams) => translate(locale, key, params),
    [locale]
  );

  const dateLocale = locale === 'ru' ? 'ru-RU' : 'en-US';

  return (
    <I18nContext.Provider value={{ locale, dateLocale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}
