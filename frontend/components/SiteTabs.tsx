"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/context";

const TAB_KEYS = [
  { key: "overview", path: (id: string) => `/sites/${id}` },
  { key: "logs", path: (id: string) => `/sites/${id}/logs` },
  { key: "settings", path: (id: string) => `/sites/${id}/settings` },
  { key: "secrets", path: (id: string) => `/sites/${id}/secrets` },
  { key: "deployments", path: (id: string) => `/sites/${id}/deployments` },
] as const;

export function SiteTabs({
  siteId,
  active,
}: {
  siteId: string;
  active: string;
}) {
  const { t } = useI18n();

  return (
    <nav
      className="site-tabs"
      aria-label={t("siteTabs.ariaLabel")}
    >
      {TAB_KEYS.map((tab) => {
        const isActive = active === tab.key;
        return (
          <Link
            key={tab.key}
            href={tab.path(siteId)}
            className={isActive ? "site-tab site-tab-active" : "site-tab"}
          >
            {t(`siteTabs.${tab.key}`)}
          </Link>
        );
      })}
    </nav>
  );
}
