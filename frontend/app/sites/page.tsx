"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { HealthBadge } from "@/components/HealthBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { api, ApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n/context";
import { siteUrlHref } from "@/lib/site-url";
import type { SiteHealth, SiteListItem } from "@/lib/types";

export default function SitesPage() {
  const { t, formatDateTime } = useI18n();
  const [sites, setSites] = useState<SiteListItem[]>([]);
  const [healthBySite, setHealthBySite] = useState<Record<string, SiteHealth>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadHealth = useCallback(async () => {
    try {
      const rows = await api.listSitesHealth();
      const map: Record<string, SiteHealth> = {};
      for (const h of rows) {
        map[h.site_id] = h;
      }
      setHealthBySite(map);
    } catch {
      /* health is optional on list */
    }
  }, []);

  useEffect(() => {
    api
      .listSites()
      .then(setSites)
      .catch((e: unknown) => {
        setError(e instanceof ApiError ? e.message : t("sites.loadFailed"));
      })
      .finally(() => setLoading(false));
    loadHealth();
    const timer = setInterval(loadHealth, 30_000);
    return () => clearInterval(timer);
  }, [loadHealth, t]);

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.5rem",
        }}
      >
        <h1>{t("sites.title")}</h1>
        <Link href="/sites/new" className="btn">
          {t("nav.newSite")}
        </Link>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <p style={{ color: "var(--muted)" }}>{t("common.loading")}</p>
      ) : sites.length === 0 ? (
        <div className="card">
          <p>{t("sites.empty")}</p>
          <Link href="/sites/new" className="btn" style={{ marginTop: "1rem" }}>
            {t("sites.createSite")}
          </Link>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="table">
            <thead>
              <tr>
                <th>{t("sites.tableName")}</th>
                <th>{t("sites.tableType")}</th>
                <th>{t("sites.tableUrl")}</th>
                <th>{t("sites.tableHealth")}</th>
                <th>{t("sites.tableStatus")}</th>
                <th>{t("sites.tableUpdated")}</th>
              </tr>
            </thead>
            <tbody>
              {sites.map((site) => (
                <tr key={site.id}>
                  <td>
                    <Link href={`/sites/${site.id}`}>{site.name}</Link>
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                      {site.slug}
                    </div>
                  </td>
                  <td>
                    {site.site_type === "telegram_bot"
                      ? t("sites.typeTelegramBot")
                      : t("sites.typeWebsite")}
                  </td>
                  <td>
                    {site.site_type === "telegram_bot" ? (
                      t("common.emDash")
                    ) : site.primary_url ? (
                      <a
                        href={siteUrlHref(site.primary_url)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {site.primary_url}
                      </a>
                    ) : (
                      t("common.emDash")
                    )}
                  </td>
                  <td>
                    {healthBySite[site.id] ? (
                      <span title={healthBySite[site.id].message}>
                        <HealthBadge overall={healthBySite[site.id].overall} />
                      </span>
                    ) : (
                      <span style={{ color: "var(--muted)", fontSize: "0.875rem" }}>
                        …
                      </span>
                    )}
                  </td>
                  <td>
                    <StatusBadge status={site.status} />
                  </td>
                  <td>{formatDateTime(site.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
