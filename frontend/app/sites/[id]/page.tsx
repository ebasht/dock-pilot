"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ContainerLogStream } from "@/components/ContainerLogStream";
import { DeploymentLogStream } from "@/components/DeploymentLogStream";
import { SiteHealthPanel } from "@/components/SiteHealthPanel";
import { SiteTabs } from "@/components/SiteTabs";
import { StatusBadge } from "@/components/StatusBadge";
import { api, ApiError } from "@/lib/api";
import type { Deployment, Site } from "@/lib/types";

export default function SiteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [site, setSite] = useState<Site | null>(null);
  const [latestDep, setLatestDep] = useState<Deployment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deploying, setDeploying] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, deps] = await Promise.all([
        api.getSite(id),
        api.listDeployments(id),
      ]);
      setSite(s);
      setLatestDep(deps[0] ?? null);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load site");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDeploy = async () => {
    setDeploying(true);
    try {
      const dep = await api.deploySite(id);
      setLatestDep(dep);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Deploy failed");
    } finally {
      setDeploying(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this site and all related data?")) return;
    await api.deleteSite(id);
    router.push("/sites");
  };

  if (!site && !error) {
    return <p style={{ color: "var(--muted)" }}>Loading…</p>;
  }

  if (error && !site) {
    return <div className="alert alert-error">{error}</div>;
  }

  if (!site) return null;

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "0.5rem",
        }}
      >
        <div>
          <h1>{site.name}</h1>
          <p style={{ color: "var(--muted)", margin: 0 }}>
            {site.site_type === "telegram_bot"
              ? "Telegram bot"
              : site.primary_url}{" "}
            · <StatusBadge status={site.status} />
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            type="button"
            className="btn"
            onClick={handleDeploy}
            disabled={deploying}
          >
            {deploying ? "Starting…" : "Deploy"}
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={handleDelete}
          >
            Delete
          </button>
        </div>
      </div>

      <SiteTabs siteId={id} active="overview" />

      {error && <div className="alert alert-error">{error}</div>}

      <SiteHealthPanel siteId={id} />

      <div className="grid-2" style={{ marginTop: "1.5rem" }}>
        <div className="card">
          <h3>Configuration</h3>
          <dl>
            <Info label="Type" value={site.site_type === "telegram_bot" ? "Telegram bot" : "Website"} />
            <Info label="Slug" value={site.slug} />
            <Info label="Git" value={site.git_repo_url} />
            <Info label="Branch" value={site.git_branch} />
            {site.site_type === "web" && (
              <>
                <Info
                  label="Docker"
                  value={`${site.dockerfile_path} → :${site.container_port}`}
                />
                <Info
                  label="Host port"
                  value={
                    site.docker_network_host
                      ? "host network"
                      : site.host_port
                        ? String(site.host_port)
                        : "—"
                  }
                />
              </>
            )}
            {site.site_type === "telegram_bot" && (
              <Info label="Dockerfile" value={site.dockerfile_path} />
            )}
          </dl>
        </div>
        {site.site_type === "web" && (
          <div className="card">
            <h3>Domains</h3>
            <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
              {site.domains.map((d) => (
                <li key={d.id ?? d.domain}>
                  {d.domain}
                  {d.is_primary ? " (primary)" : ""}
                </li>
              ))}
            </ul>
            <Link
              href={`/sites/${id}/settings`}
              style={{ fontSize: "0.875rem", marginTop: "0.75rem", display: "inline-block" }}
            >
              Edit settings →
            </Link>
          </div>
        )}
        {site.site_type === "telegram_bot" && (
          <div className="card">
            <h3>Bot</h3>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.875rem" }}>
              Long polling — no public URL. Token in{" "}
              <Link href={`/sites/${id}/secrets`}>secrets</Link> (e.g. BOT_TOKEN).
            </p>
            <Link
              href={`/sites/${id}/settings`}
              style={{ fontSize: "0.875rem", marginTop: "0.75rem", display: "inline-block" }}
            >
              Edit settings →
            </Link>
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: "1.5rem" }}>
        <h3 style={{ marginTop: 0 }}>Container logs</h3>
        <p style={{ color: "var(--muted)", fontSize: "0.875rem", margin: "0 0 0.75rem" }}>
          stdout / stderr from the running Docker container (live tail).
        </p>
        <ContainerLogStream siteId={id} />
      </div>

      {latestDep && (
        <div className="card" style={{ marginTop: "1.5rem" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <h3 style={{ margin: 0 }}>Latest deployment</h3>
            <Link href={`/sites/${id}/deployments`}>All deployments →</Link>
          </div>
          <p style={{ margin: "0.5rem 0" }}>
            <StatusBadge status={latestDep.status} /> {latestDep.message}
          </p>
          <DeploymentLogStream
            deploymentId={latestDep.id}
            initialStatus={latestDep.status}
          />
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: "0.5rem" }}>
      <span style={{ color: "var(--muted)", fontSize: "0.75rem" }}>{label}</span>
      <div style={{ fontSize: "0.9rem" }}>{value}</div>
    </div>
  );
}
