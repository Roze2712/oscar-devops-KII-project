"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import mk from "@/locales/mk.json";
import en from "@/locales/en.json";

type Language = "mk" | "en";

const STORAGE_KEY = "oscar-dt-language";

const dictionaries = {
  mk,
  en,
} as const;

type Dictionary = (typeof dictionaries)["mk"];

type LanguageContextValue = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function readStoredLanguage(): Language {
  if (typeof window === "undefined") return "mk";
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "mk" || stored === "en") return stored;
  } catch {
    /* ignore storage errors */
  }
  return "mk";
}

function resolvePath(dict: Dictionary, key: string): string {
  const value = key.split(".").reduce<unknown>((acc, segment) => {
    if (acc && typeof acc === "object" && segment in acc) {
      return (acc as Record<string, unknown>)[segment];
    }
    return undefined;
  }, dict);

  return typeof value === "string" ? value : key;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(readStoredLanguage);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* ignore storage errors */
    }
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage,
      t: (key: string) => resolvePath(dictionaries[language], key),
    }),
    [language, setLanguage],
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
}

/** Alias for stacks that expect a `useTranslation`-style hook name. */
export function useTranslation() {
  return useLanguage();
}
