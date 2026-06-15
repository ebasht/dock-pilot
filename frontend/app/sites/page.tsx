"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { HealthBadge } from "@/components/HealthBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { api, ApiError } from "@/lib/api";
import { siteUrlHref } from "@/lib/site-url";
import type { SiteHealth, SiteListItem } from "@/lib/types";

export default function SitesPage() {
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
        setError(e instanceof ApiError ? e.message : "Failed to load sites");
      })
      .finally(() => setLoading(false));
    loadHealth();
    const t = setInterval(loadHealth, 30_000);
    return () => clearInterval(t);
  }, [loadHealth]);

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
        <h1>Sites</h1>
        <Link href="/sites/new" className="btn">
          New site
        </Link>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <p style={{ color: "var(--muted)" }}>Loading…</p>
      ) : sites.length === 0 ? (
        <div className="card">
          <p>No sites yet. Create your first deployment target.</p>
          <Link href="/sites/new" className="btn" style={{ marginTop: "1rem" }}>
            Create site
          </Link>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>URL</th>
                <th>Health</th>
                <th>Status</th>
                <th>Updated</th>
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
                    {site.site_type === "telegram_bot" ? "Telegram bot" : "Website"}
                  </td>
                  <td>
                    {site.site_type === "telegram_bot" ? (
                      "—"
                    ) : site.primary_url ? (
                      <a
                        href={siteUrlHref(site.primary_url)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {site.primary_url}
                      </a>
                    ) : (
                      "—"
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
                  <td>{new Date(site.updated_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
