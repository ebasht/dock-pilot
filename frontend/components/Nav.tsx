"use client";

import { useState } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { MobileQrModal } from "@/components/MobileQrModal";
import { useLogout } from "@/components/AuthGate";
import { useI18n } from "@/lib/i18n/context";

export function Nav() {
  const logout = useLogout();
  const { t } = useI18n();
  const [qrOpen, setQrOpen] = useState(false);

  return (
    <>
      <nav className="nav">
        <Link href="/sites" className="nav-brand">
          <BrandLogo showVersion />
        </Link>
        <div className="nav-links">
          <Link href="/sites">{t("nav.sites")}</Link>
          <Link href="/notifications">{t("nav.notifications")}</Link>
          <Link href="/sites/new">{t("nav.newSite")}</Link>
          <button
            type="button"
            className="btn btn-secondary nav-mobile-qr"
            onClick={() => setQrOpen(true)}
          >
            {t("nav.mobile")}
          </button>
          <LocaleSwitcher />
          <button type="button" className="btn btn-secondary nav-logout" onClick={logout}>
            {t("nav.logout")}
          </button>
        </div>
      </nav>
      <MobileQrModal open={qrOpen} onClose={() => setQrOpen(false)} />
    </>
  );
}
