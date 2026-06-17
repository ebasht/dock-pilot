"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { messages } from "./messages";
import { DEFAULT_LOCALE, LOCALE_COOKIE, type Locale, parseLocale } from "./locale";

type Params = Record<string, string | number>;

function lookup(obj: unknown, path: string): string {
  let cur: unknown = obj;
  for (const part of path.split(".")) {
    if (!cur || typeof cur !== "object" || !(part in cur)) {
      return path;
    }
    cur = (cur as Record<string, unknown>)[part];
  }
  return typeof cur === "string" ? cur : path;
}

function interpolate(template: string, params?: Params): string {
  if (!params) return template;
  let out = template;
  for (const [key, value] of Object.entries(params)) {
    out = out.replaceAll(`{${key}}`, String(value));
  }
  return out;
}

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Params) => string;
  formatDateTime: (date: string | Date) => string;
  formatTime: (date: string | Date) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function LocaleProvider({
  children,
  initialLocale,
}: {
  children: ReactNode;
  initialLocale?: Locale;
}) {
  const router = useRouter();
  const [locale, setLocaleState] = useState<Locale>(
    () => initialLocale ?? DEFAULT_LOCALE,
  );

  const setLocale = useCallback(
    (next: Locale) => {
      const safe = parseLocale(next);
      document.cookie = `${LOCALE_COOKIE}=${safe};path=/;max-age=31536000;SameSite=Lax`;
      setLocaleState(safe);
      router.refresh();
    },
    [router],
  );

  const t = useCallback(
    (key: string, params?: Params) =>
      interpolate(lookup(messages[locale], key), params),
    [locale],
  );

  const intlLocale = locale === "ru" ? "ru-RU" : "en-US";

  const formatDateTime = useCallback(
    (date: string | Date) => new Date(date).toLocaleString(intlLocale),
    [intlLocale],
  );

  const formatTime = useCallback(
    (date: string | Date) => new Date(date).toLocaleTimeString(intlLocale),
    [intlLocale],
  );

  const value = useMemo(
    () => ({ locale, setLocale, t, formatDateTime, formatTime }),
    [locale, setLocale, t, formatDateTime, formatTime],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within LocaleProvider");
  }
  return ctx;
}
