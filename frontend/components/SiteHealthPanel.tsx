"use client";

import { useCallback, useEffect, useState } from "react";
import { HealthBadge } from "@/components/HealthBadge";
import { api, ApiError } from "@/lib/api";
import type { SiteHealth } from "@/lib/types";

export function SiteHealthPanel({
  siteId,
  autoRefreshMs = 30_000,
}: {
  siteId: string;
  autoRefreshMs?: number;
}) {
  const [health, setHealth] = useState<SiteHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const h = await api.getSiteHealth(siteId);
      setHealth(h);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Health check failed");
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => {
    setLoading(true);
    load();
    if (!autoRefreshMs) return;
    const t = setInterval(load, autoRefreshMs);
    return () => clearInterval(t);
  }, [load, autoRefreshMs]);

  if (loading && !health) {
    return (
      <div className="card">
        <h3>Health</h3>
        <p style={{ color: "var(--muted)", margin: 0 }}>Checking…</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "0.75rem",
        }}
      >
        <h3 style={{ margin: 0 }}>Health</h3>
        <button type="button" className="btn btn-secondary" onClick={() => load()}>
          Refresh
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {health && (
        <>
          <p style={{ margin: "0 0 0.75rem" }}>
            <HealthBadge overall={health.overall} />{" "}
            <span style={{ color: "var(--muted)", fontSize: "0.875rem" }}>
              {health.message}
            </span>
          </p>
          <dl style={{ margin: 0, fontSize: "0.875rem" }}>
            {health.container && (
              <>
                <HealthRow
                  label="Container"
                  value={
                    health.container.found
                      ? `${health.container.container || "—"} · ${health.container.state}${
                          health.container.health && health.container.health !== "none"
                            ? ` · HEALTH ${health.container.health}`
                            : ""
                        }`
                      : "not found"
                  }
                />
              </>
            )}
            {health.http && (
              <HealthRow
                label="HTTP"
                value={
                  health.http.ok
                    ? `${health.http.url} → ${health.http.status_code}`
                    : health.http.error
                      ? `${health.http.url}: ${health.http.error}`
                      : `${health.http.url} → ${health.http.status_code}`
                }
              />
            )}
            <HealthRow
              label="Checked"
              value={new Date(health.checked_at).toLocaleString()}
            />
          </dl>
        </>
      )}
    </div>
  );
}

function HealthRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: "0.35rem" }}>
      <span style={{ color: "var(--muted)" }}>{label}: </span>
      {value}
    </div>
  );
}
