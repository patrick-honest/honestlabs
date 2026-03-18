"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";

export type Locale = "en" | "id" | "ja";

const LANGUAGE_STORAGE_KEY = "honest_language";
const LOCALES: Locale[] = ["en", "id", "ja"];
const LOCALE_LABELS: Record<Locale, string> = {
  en: "EN",
  id: "ID",
  ja: "JP",
};
const LOCALE_FULL_LABELS: Record<Locale, string> = {
  en: "English",
  id: "Bahasa Indonesia",
  ja: "日本語",
};

interface LanguageContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  locales: Locale[];
  localeLabels: Record<Locale, string>;
  localeFullLabels: Record<Locale, string>;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

// Pre-load all message files
const messageCache: Record<string, Record<string, unknown>> = {};

async function loadMessages(locale: Locale): Promise<Record<string, unknown>> {
  if (messageCache[locale]) return messageCache[locale];
  const mod = await import(`../../messages/${locale}.json`);
  messageCache[locale] = mod.default;
  return mod.default;
}

export function LanguageProvider({ children, initialMessages }: { children: ReactNode; initialMessages: Record<string, unknown> }) {
  const [locale, setLocaleRaw] = useState<Locale>("en");
  const [messages, setMessages] = useState<Record<string, unknown>>(initialMessages);

  // Hydrate from localStorage after mount
  useEffect(() => {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY) as Locale | null;
    if (saved && LOCALES.includes(saved)) {
      setLocaleRaw(saved);
      loadMessages(saved).then(setMessages);
    }
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleRaw(l);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, l);
    loadMessages(l).then(setMessages);
  }, []);

  return (
    <LanguageContext.Provider value={{ locale, setLocale, locales: LOCALES, localeLabels: LOCALE_LABELS, localeFullLabels: LOCALE_FULL_LABELS }}>
      <NextIntlClientProvider locale={locale} messages={messages} timeZone="Asia/Jakarta">
        {children}
      </NextIntlClientProvider>
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
