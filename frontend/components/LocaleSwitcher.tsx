"use client";

import { useI18n } from "@/lib/i18n/context";
import type { Locale } from "@/lib/i18n/locale";

export function LocaleSwitcher({ className }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();

  const onChange = (next: Locale) => {
    if (next !== locale) setLocale(next);
  };

  return (
    <div className={className ?? "locale-switcher"} role="group" aria-label={t("nav.language")}>
      <button
        type="button"
        className={`locale-btn${locale === "en" ? " locale-btn-active" : ""}`}
        onClick={() => onChange("en")}
        aria-pressed={locale === "en"}
      >
        EN
      </button>
      <button
        type="button"
        className={`locale-btn${locale === "ru" ? " locale-btn-active" : ""}`}
        onClick={() => onChange("ru")}
        aria-pressed={locale === "ru"}
      >
        RU
      </button>
    </div>
  );
}
