export const LOCALES = ["en", "ru"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "dock-pilot-locale";

export function parseLocale(value?: string | null): Locale {
  return value === "ru" ? "ru" : "en";
}
