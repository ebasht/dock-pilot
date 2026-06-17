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
import { useI18n } from "@/lib/i18n/context";
import type { Deployment, Site } from "@/lib/types";

export default function SiteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const [site, setSite] = useState<Site | null>(null);
  const [latestDep, setLatestDep] = useState<Deployment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [containerBusy, setContainerBusy] = useState<"start" | "stop" | "restart" | null>(null);
  const [healthRefreshKey, setHealthRefreshKey] = useState(0);

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
      setError(e instanceof ApiError ? e.message : t("site.loadFailed"));
    }
  }, [id, t]);

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
      setError(e instanceof ApiError ? e.message : t("site.deployFailed"));
    } finally {
      setDeploying(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(t("site.deleteConfirm"))) return;
    await api.deleteSite(id);
    router.push("/sites");
  };

  const handleContainerAction = async (action: "start" | "stop" | "restart") => {
    setContainerBusy(action);
    setError(null);
    try {
      if (action === "start") await api.startSiteContainer(id);
      else if (action === "stop") await api.stopSiteContainer(id);
      else await api.restartSiteContainer(id);
      await load();
      setHealthRefreshKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("site.containerActionFailed"));
    } finally {
      setContainerBusy(null);
    }
  };

  if (!site && !error) {
    return <p style={{ color: "var(--muted)" }}>{t("common.loading")}</p>;
  }

  if (error && !site) {
    return <div className="alert alert-error">{error}</div>;
  }

  if (!site) return null;

  const typeLabel =
    site.site_type === "telegram_bot" ? t("sites.typeTelegramBot") : t("sites.typeWebsite");
  const canControlContainer = site.status !== "draft";
  const busy = deploying || containerBusy !== null;

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
            {site.site_type === "telegram_bot" ? typeLabel : site.primary_url}{" "}
            · <StatusBadge status={site.status} />
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button
            type="button"
            className="btn"
            onClick={handleDeploy}
            disabled={busy}
          >
            {deploying ? t("site.starting") : t("site.deploy")}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => handleContainerAction("start")}
            disabled={busy || !canControlContainer}
          >
            {containerBusy === "start" ? t("site.starting") : t("site.start")}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => handleContainerAction("stop")}
            disabled={busy || !canControlContainer}
          >
            {containerBusy === "stop" ? t("site.stopping") : t("site.stop")}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => handleContainerAction("restart")}
            disabled={busy || !canControlContainer}
          >
            {containerBusy === "restart" ? t("site.restarting") : t("site.restart")}
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={handleDelete}
            disabled={busy}
          >
            {t("common.delete")}
          </button>
        </div>
      </div>

      <SiteTabs siteId={id} active="overview" />

      {error && <div className="alert alert-error">{error}</div>}

      <SiteHealthPanel key={healthRefreshKey} siteId={id} />

      <div className="grid-2" style={{ marginTop: "1.5rem" }}>
        <div className="card">
          <h3>{t("site.configuration")}</h3>
          <dl>
            <Info label={t("common.type")} value={typeLabel} />
            <Info label={t("site.slug")} value={site.slug} />
            <Info label={t("site.git")} value={site.git_repo_url} />
            <Info label={t("site.branch")} value={site.git_branch} />
            {site.site_type === "web" && (
              <>
                <Info
                  label={t("site.docker")}
                  value={`${site.dockerfile_path} → :${site.container_port}`}
                />
                <Info
                  label={t("site.hostPort")}
                  value={
                    site.docker_network_host
                      ? t("site.hostNetwork")
                      : site.host_port
                        ? String(site.host_port)
                        : t("common.emDash")
                  }
                />
              </>
            )}
            {site.site_type === "telegram_bot" && (
              <Info label={t("site.dockerfile")} value={site.dockerfile_path} />
            )}
          </dl>
        </div>
        {site.site_type === "web" && (
          <div className="card">
            <h3>{t("site.domains")}</h3>
            <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
              {site.domains.map((d) => (
                <li key={d.id ?? d.domain}>
                  {d.domain}
                  {d.is_primary ? ` ${t("common.primary")}` : ""}
                </li>
              ))}
            </ul>
            <Link
              href={`/sites/${id}/settings`}
              style={{ fontSize: "0.875rem", marginTop: "0.75rem", display: "inline-block" }}
            >
              {t("site.editSettings")}
            </Link>
          </div>
        )}
        {site.site_type === "telegram_bot" && (
          <div className="card">
            <h3>{t("site.bot")}</h3>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.875rem" }}>
              {t("site.botHintBefore")}{" "}
              <Link href={`/sites/${id}/secrets`}>{t("site.secretsLink")}</Link>{" "}
              {t("site.botHintAfter")}
            </p>
            <Link
              href={`/sites/${id}/settings`}
              style={{ fontSize: "0.875rem", marginTop: "0.75rem", display: "inline-block" }}
            >
              {t("site.editSettings")}
            </Link>
          </div>
        )}
      </div>

      {site.site_type === "telegram_bot" && (
        <div className="card" style={{ marginTop: "1.5rem" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "0.75rem",
            }}
          >
            <h3 style={{ margin: 0 }}>{t("site.containerLogs")}</h3>
            <Link href={`/sites/${id}/logs`} style={{ fontSize: "0.875rem" }}>
              {t("site.openLogsTab")}
            </Link>
          </div>
          <p style={{ color: "var(--muted)", fontSize: "0.875rem", margin: "0 0 0.75rem" }}>
            {t("site.containerLogsHint")}
          </p>
          <ContainerLogStream siteId={id} />
        </div>
      )}

      {site.site_type === "web" && (
        <p style={{ marginTop: "1.5rem" }}>
          <Link href={`/sites/${id}/logs`} style={{ fontSize: "0.875rem" }}>
            {t("site.containerLogsLink")}
          </Link>
        </p>
      )}

      {latestDep && (
        <div className="card" style={{ marginTop: "1.5rem" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <h3 style={{ margin: 0 }}>{t("site.latestDeployment")}</h3>
            <Link href={`/sites/${id}/deployments`}>{t("site.allDeployments")}</Link>
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
