"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { api, ApiError } from "@/lib/api";
import type { SiteListItem } from "@/lib/types";

export default function SitesPage() {
  const [sites, setSites] = useState<SiteListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .listSites()
      .then(setSites)
      .catch((e: unknown) => {
        setError(e instanceof ApiError ? e.message : "Failed to load sites");
      })
      .finally(() => setLoading(false));
  }, []);

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
                    {site.site_type === "telegram_bot" ? "—" : site.primary_url}
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
