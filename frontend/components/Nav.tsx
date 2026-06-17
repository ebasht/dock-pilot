"use client";

import Link from "next/link";
import { AppVersion } from "@/components/AppVersion";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { useLogout } from "@/components/AuthGate";
import { useI18n } from "@/lib/i18n/context";

export function Nav() {
  const logout = useLogout();
  const { t } = useI18n();

  return (
    <nav className="nav">
      <Link href="/sites" className="nav-brand">
        DockPilot <AppVersion />
      </Link>
      <div className="nav-links">
        <Link href="/sites">{t("nav.sites")}</Link>
        <Link href="/notifications">{t("nav.notifications")}</Link>
        <Link href="/sites/new">{t("nav.newSite")}</Link>
        <LocaleSwitcher />
        <button type="button" className="btn btn-secondary nav-logout" onClick={logout}>
          {t("nav.logout")}
        </button>
      </div>
    </nav>
  );
}
