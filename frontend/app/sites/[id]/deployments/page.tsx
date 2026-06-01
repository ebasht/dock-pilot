"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { DeploymentLogStream } from "@/components/DeploymentLogStream";
import { SiteTabs } from "@/components/SiteTabs";
import { StatusBadge } from "@/components/StatusBadge";
import { api, ApiError } from "@/lib/api";
import type { Deployment, Site } from "@/lib/types";

export default function SiteDeploymentsPage() {
  const { id } = useParams<{ id: string }>();
  const [site, setSite] = useState<Site | null>(null);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deploying, setDeploying] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, deps] = await Promise.all([
        api.getSite(id),
        api.listDeployments(id),
      ]);
      setSite(s);
      setDeployments(deps);
      if (!selectedId && deps[0]) setSelectedId(deps[0].id);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load");
    }
  }, [id, selectedId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [load]);

  const handleDeploy = async () => {
    setDeploying(true);
    try {
      const dep = await api.deploySite(id);
      setSelectedId(dep.id);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Deploy failed");
    } finally {
      setDeploying(false);
    }
  };

  const selected = deployments.find((d) => d.id === selectedId);

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h1>{site?.name ?? "Deployments"}</h1>
        <button
          type="button"
          className="btn"
          onClick={handleDeploy}
          disabled={deploying}
        >
          {deploying ? "Starting…" : "New deployment"}
        </button>
      </div>

      <SiteTabs siteId={id} active="deployments" />
      {error && <div className="alert alert-error">{error}</div>}

      <div className="grid-2" style={{ alignItems: "start" }}>
        <div className="card" style={{ padding: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {deployments.map((d) => (
                <tr
                  key={d.id}
                  onClick={() => setSelectedId(d.id)}
                  style={{
                    cursor: "pointer",
                    background:
                      d.id === selectedId ? "var(--surface-hover)" : undefined,
                  }}
                >
                  <td>
                    <StatusBadge status={d.status} />
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                      {d.message}
                    </div>
                  </td>
                  <td>{new Date(d.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {deployments.length === 0 && (
            <p style={{ padding: "1rem", color: "var(--muted)" }}>
              No deployments yet.
            </p>
          )}
        </div>

        <div className="card">
          {selected ? (
            <>
              <h3 style={{ marginTop: 0 }}>Deployment logs</h3>
              <p style={{ fontSize: "0.875rem", color: "var(--muted)" }}>
                ID: <code>{selected.id}</code>
              </p>
              <DeploymentLogStream
                deploymentId={selected.id}
                initialStatus={selected.status}
              />
            </>
          ) : (
            <p style={{ color: "var(--muted)" }}>Select a deployment.</p>
          )}
        </div>
      </div>

      <Link href={`/sites/${id}`} style={{ marginTop: "1rem", display: "inline-block" }}>
        ← Back to overview
      </Link>
    </div>
  );
}
