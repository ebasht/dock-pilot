"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { EnvVarList } from "@/components/EnvVarList";
import { SiteTabs } from "@/components/SiteTabs";
import { api, ApiError } from "@/lib/api";
import type { CreateSiteRequest, EnvVar, Site } from "@/lib/types";

export default function SiteSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const [site, setSite] = useState<Site | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [primaryUrl, setPrimaryUrl] = useState("");
  const [gitRepoUrl, setGitRepoUrl] = useState("");
  const [gitBranch, setGitBranch] = useState("");
  const [dockerfilePath, setDockerfilePath] = useState("");
  const [buildContext, setBuildContext] = useState("");
  const [containerPort, setContainerPort] = useState(3000);
  const [envVars, setEnvVars] = useState<EnvVar[]>([]);
  const [envVarsDirty, setEnvVarsDirty] = useState(false);
  const [aliases, setAliases] = useState("");
  const [nginxSsl, setNginxSsl] = useState(true);
  const [nginxHttps, setNginxHttps] = useState(true);
  const [volumeMounts, setVolumeMounts] = useState("");
  const [namedVolumes, setNamedVolumes] = useState("");
  const [dockerNetworkHost, setDockerNetworkHost] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await api.getSite(id);
      setSite(s);
      setName(s.name);
      setPrimaryUrl(s.primary_url);
      setGitRepoUrl(s.git_repo_url);
      setGitBranch(s.git_branch);
      setDockerfilePath(s.dockerfile_path);
      setBuildContext(s.build_context);
      setContainerPort(s.container_port);
      setEnvVars(s.env_vars.length ? s.env_vars : [{ key: "", value: "" }]);
      setEnvVarsDirty(false);
      setAliases(
        s.domains
          .filter((d) => !d.is_primary)
          .map((d) => d.domain)
          .join("\n"),
      );
      setNginxSsl(s.nginx_ssl_enabled);
      setNginxHttps(s.nginx_force_https);
      setVolumeMounts((s.docker_volume_mounts ?? []).join("\n"));
      setNamedVolumes((s.docker_named_volumes ?? []).join("\n"));
      setDockerNetworkHost(s.docker_network_host ?? false);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      const domains = aliases
        .split("\n")
        .map((d) => d.trim())
        .filter(Boolean)
        .map((domain) => ({ domain, is_primary: false }));

      const body: Partial<CreateSiteRequest> = {
        name,
        ...(site?.site_type === "web"
          ? {
              primary_url: primaryUrl,
              container_port: containerPort,
              nginx_ssl_enabled: nginxSsl,
              nginx_force_https: nginxHttps,
              domains,
            }
          : {}),
        git_repo_url: gitRepoUrl,
        git_branch: gitBranch,
        dockerfile_path: dockerfilePath,
        build_context: buildContext,
        docker_volume_mounts: volumeMounts
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean),
        docker_named_volumes: namedVolumes
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean),
        docker_network_host: dockerNetworkHost,
      };
      if (envVarsDirty) {
        body.env_vars = envVars
          .filter((ev) => ev.key.trim())
          .map((ev) => ({ key: ev.key.trim(), value: ev.value }));
      }
      await api.updateSite(id, body);
      setSaved(true);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (!site && !error) return <p style={{ color: "var(--muted)" }}>Loading…</p>;

  return (
    <div>
      <h1>{site?.name ?? "Settings"}</h1>
      <SiteTabs siteId={id} active="settings" />

      {error && <div className="alert alert-error">{error}</div>}
      {saved && (
        <div className="alert" style={{ background: "#14532d", color: "#86efac" }}>
          Settings saved.
        </div>
      )}

      <form onSubmit={handleSave} className="card">
        <h2>Site settings</h2>
        <div className="field">
          <label className="label">Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        {site?.site_type === "web" && (
          <div className="field">
            <label className="label">Primary URL</label>
            <input
              className="input"
              value={primaryUrl}
              onChange={(e) => setPrimaryUrl(e.target.value)}
            />
          </div>
        )}
        <div className="field">
          <label className="label">Git repository</label>
          <input
            className="input"
            value={gitRepoUrl}
            onChange={(e) => setGitRepoUrl(e.target.value)}
          />
        </div>
        <div className="field">
          <label className="label">Branch</label>
          <input
            className="input"
            value={gitBranch}
            onChange={(e) => setGitBranch(e.target.value)}
          />
        </div>
        <div className="grid-2">
          <div className="field">
            <label className="label">Dockerfile</label>
            <input
              className="input"
              value={dockerfilePath}
              onChange={(e) => setDockerfilePath(e.target.value)}
            />
          </div>
          <div className="field">
            <label className="label">Build context</label>
            <input
              className="input"
              value={buildContext}
              onChange={(e) => setBuildContext(e.target.value)}
            />
          </div>
        </div>
        {site?.site_type === "web" && (
          <>
            <div className="field">
              <label className="label">
                Container port (EXPOSE in Dockerfile, e.g. 80 for nginx)
              </label>
              <input
                className="input"
                type="number"
                value={containerPort}
                onChange={(e) => setContainerPort(parseInt(e.target.value, 10) || 3000)}
              />
            </div>
            <div className="field">
              <label className="label">Domain aliases</label>
              <textarea
                className="textarea"
                value={aliases}
                onChange={(e) => setAliases(e.target.value)}
              />
            </div>
            <label style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <input
                type="checkbox"
                checked={nginxSsl}
                onChange={(e) => setNginxSsl(e.target.checked)}
              />
              SSL enabled
            </label>
            <label style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
              <input
                type="checkbox"
                checked={nginxHttps}
                onChange={(e) => setNginxHttps(e.target.checked)}
              />
              Force HTTPS
            </label>
          </>
        )}
        {site?.site_type === "telegram_bot" && (
          <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>
            Telegram bot — no nginx or ports. Use secrets for BOT_TOKEN.
          </p>
        )}

        <h3>Docker volumes</h3>
        <p style={{ color: "var(--muted)", fontSize: "0.875rem", marginBottom: "0.75rem" }}>
          Compose-style persistence. Named volumes are prefixed with{" "}
          <code>dockpilot-&lt;slug&gt;-</code> on the host (e.g.{" "}
          <code>dict-data:/data</code> → <code>dockpilot-my-site-dict-data</code>).
        </p>
        <div className="field">
          <label className="label">Volume mounts (service volumes)</label>
          <textarea
            className="textarea"
            placeholder={"dict-data:/data\n/host/cache:/cache:ro"}
            value={volumeMounts}
            onChange={(e) => setVolumeMounts(e.target.value)}
            rows={4}
          />
        </div>
        <div className="field">
          <label className="label">Named volumes (top-level volumes:)</label>
          <textarea
            className="textarea"
            placeholder={"dict-data"}
            value={namedVolumes}
            onChange={(e) => setNamedVolumes(e.target.value)}
            rows={2}
          />
        </div>

        <label style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start", marginBottom: "1rem" }}>
          <input
            type="checkbox"
            checked={dockerNetworkHost}
            onChange={(e) => setDockerNetworkHost(e.target.checked)}
            style={{ marginTop: "0.2rem" }}
          />
          <span>
            <strong>Host network</strong> (<code>network_mode: host</code>) — no Docker port
            mapping; app listens on container port directly on the VPS. Nginx uses that port
            on <code>127.0.0.1</code>.
          </span>
        </label>

        <h3>Environment variables</h3>
        <p style={{ color: "var(--muted)", fontSize: "0.875rem", marginBottom: "0.75rem" }}>
          Saved separately from Docker/nginx fields below — editing env vars marks this
          section dirty; other settings saves will not touch them.
        </p>
        <EnvVarList
          envVars={envVars}
          onChange={(next) => {
            setEnvVarsDirty(true);
            setEnvVars(next);
          }}
        />

        <button type="submit" className="btn" disabled={saving}>
          {saving ? "Saving…" : "Save settings"}
        </button>
      </form>
    </div>
  );
}
