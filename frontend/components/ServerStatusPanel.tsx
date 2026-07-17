"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { formatBytes, formatPercent } from "@/lib/format";
import { useI18n } from "@/lib/i18n/context";
import type { SystemStatus } from "@/lib/types";

function diskTone(pct: number): string {
  if (pct >= 90) return "var(--danger, #b91c1c)";
  if (pct >= 80) return "var(--warn, #b45309)";
  return "var(--ok, #15803d)";
}

export function ServerStatusPanel() {
  const { t, formatDateTime } = useI18n();
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pruning, setPruning] = useState(false);
  const [pruneMsg, setPruneMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const s = await api.getSystemStatus();
      setStatus(s);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("system.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 30_000);
    return () => clearInterval(timer);
  }, [load]);

  const handlePrune = async () => {
    setPruning(true);
    setPruneMsg(null);
    try {
      const r = await api.pruneDocker();
      setPruneMsg(
        t("system.pruneDone", {
          images: String(r.images_deleted),
          containers: String(r.containers_deleted),
          freed: formatBytes(r.space_reclaimed),
        }),
      );
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("system.pruneFailed"));
    } finally {
      setPruning(false);
    }
  };

  if (loading && !status) {
    return (
      <div className="card" style={{ marginBottom: "1.25rem" }}>
        <h2 style={{ margin: 0, fontSize: "1.1rem" }}>{t("system.title")}</h2>
        <p style={{ color: "var(--muted)", margin: "0.5rem 0 0" }}>{t("common.loading")}</p>
      </div>
    );
  }

  if (error && !status) {
    return (
      <div className="card" style={{ marginBottom: "1.25rem" }}>
        <h2 style={{ margin: 0, fontSize: "1.1rem" }}>{t("system.title")}</h2>
        <div className="alert alert-error" style={{ marginTop: "0.75rem" }}>
          {error}
        </div>
      </div>
    );
  }

  if (!status) return null;

  const root = status.disk[0];
  const mem = status.memory;

  return (
    <div className="card server-status" style={{ marginBottom: "1.25rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "0.75rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>{t("system.title")}</h2>
          <p style={{ color: "var(--muted)", fontSize: "0.8125rem", margin: "0.25rem 0 0" }}>
            {t("common.checked")}: {formatDateTime(status.checked_at)}
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button type="button" className="btn btn-secondary" onClick={load} disabled={loading}>
            {t("common.refresh")}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handlePrune}
            disabled={pruning}
            title={t("system.pruneHint")}
          >
            {pruning ? t("system.pruning") : t("system.pruneDocker")}
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginTop: "0.75rem" }}>
          {error}
        </div>
      )}
      {pruneMsg && (
        <div className="alert alert-success" style={{ marginTop: "0.75rem" }}>
          {pruneMsg}
        </div>
      )}

      <div className="server-status-grid">
        {root && (
          <div>
            <div className="server-status-label">{t("system.disk")}</div>
            <div className="server-status-value" style={{ color: diskTone(root.used_percent) }}>
              {formatPercent(root.used_percent)}
            </div>
            <div className="server-status-meta">
              {formatBytes(root.available_bytes)} {t("system.free")} ·{" "}
              {formatBytes(root.used_bytes)} / {formatBytes(root.total_bytes)}
            </div>
            <div className="meter" aria-hidden>
              <div
                className="meter-fill"
                style={{
                  width: `${Math.min(100, root.used_percent)}%`,
                  background: diskTone(root.used_percent),
                }}
              />
            </div>
          </div>
        )}

        <div>
          <div className="server-status-label">{t("system.memory")}</div>
          <div className="server-status-value">{formatPercent(mem.used_percent)}</div>
          <div className="server-status-meta">
            {formatBytes(mem.available_bytes)} {t("system.free")} ·{" "}
            {formatBytes(mem.used_bytes)} / {formatBytes(mem.total_bytes)}
          </div>
          <div className="meter" aria-hidden>
            <div
              className="meter-fill"
              style={{ width: `${Math.min(100, mem.used_percent)}%` }}
            />
          </div>
        </div>

        <div>
          <div className="server-status-label">{t("system.docker")}</div>
          <div className="server-status-value">
            {formatBytes(
              (status.docker?.images_bytes ?? 0) +
                (status.docker?.build_cache_bytes ?? 0) +
                (status.docker?.volumes_bytes ?? 0),
            )}
          </div>
          <div className="server-status-meta">
            {t("system.images")}: {formatBytes(status.docker?.images_bytes)} ·{" "}
            {t("system.buildCache")}: {formatBytes(status.docker?.build_cache_bytes)}
            {(status.docker?.reclaimable_bytes ?? 0) > 0
              ? ` · ${t("system.reclaimable")}: ${formatBytes(status.docker.reclaimable_bytes)}`
              : ""}
          </div>
        </div>
      </div>

      <div className="server-status-procs">
        <div>
          <h3 className="server-status-label">{t("system.topCpu")}</h3>
          <ProcessTable rows={status.top_cpu} empty={t("system.noProcesses")} />
        </div>
        <div>
          <h3 className="server-status-label">{t("system.topMem")}</h3>
          <ProcessTable rows={status.top_mem} empty={t("system.noProcesses")} mem />
        </div>
      </div>
    </div>
  );
}

function ProcessTable({
  rows,
  empty,
  mem,
}: {
  rows: SystemStatus["top_cpu"];
  empty: string;
  mem?: boolean;
}) {
  if (!rows?.length) {
    return <p style={{ color: "var(--muted)", fontSize: "0.8125rem" }}>{empty}</p>;
  }
  return (
    <div className="table-wrap">
      <table className="table table-compact">
        <thead>
          <tr>
            <th>PID</th>
            <th>{mem ? "MEM" : "CPU"}</th>
            <th>RSS</th>
            <th>CMD</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={`${p.pid}-${p.command}`}>
              <td>{p.pid}</td>
              <td>{mem ? formatPercent(p.mem_percent) : formatPercent(p.cpu_percent)}</td>
              <td>{formatBytes(p.rss_bytes)}</td>
              <td className="cmd-cell" title={p.command}>
                {p.command}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
