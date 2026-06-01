"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { EnvVarList } from "@/components/EnvVarList";
import { KeyValueEditor } from "@/components/KeyValueEditor";
import { api, ApiError } from "@/lib/api";
import type { WizardState } from "@/lib/types";

const WEB_STEPS = [
  "Basic",
  "Repository",
  "Docker",
  "Environment",
  "Nginx & SSL",
  "Review",
] as const;

const BOT_STEPS = [
  "Basic",
  "Repository",
  "Docker",
  "Environment",
  "Review",
] as const;

const initialState: WizardState = {
  siteType: "web",
  name: "",
  slug: "",
  primaryUrl: "",
  gitRepoUrl: "",
  gitBranch: "main",
  dockerfilePath: "Dockerfile",
  buildContext: ".",
  containerPort: 3000,
  dockerNetworkHost: false,
  envVars: [],
  secrets: [],
  aliases: [],
  nginxSslEnabled: true,
  nginxForceHttps: true,
};

export default function NewSiteWizardPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardState>(initialState);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const steps = data.siteType === "telegram_bot" ? BOT_STEPS : WEB_STEPS;

  const update = (patch: Partial<WizardState>) =>
    setData((d) => {
      const next = { ...d, ...patch };
      if (patch.siteType === "telegram_bot") {
        next.nginxSslEnabled = false;
        next.nginxForceHttps = false;
      }
      return next;
    });

  const next = () => setStep((s) => Math.min(s + 1, steps.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const stepKey = steps[step];

  const handleDeploy = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const domains =
        data.siteType === "web"
          ? data.aliases
              .filter((a) => a.trim())
              .map((domain) => ({ domain: domain.trim(), is_primary: false }))
          : [];

      const site = await api.createSite({
        name: data.name,
        slug: data.slug || undefined,
        site_type: data.siteType,
        primary_url:
          data.siteType === "web" ? data.primaryUrl : data.primaryUrl || "",
        git_repo_url: data.gitRepoUrl,
        git_branch: data.gitBranch,
        dockerfile_path: data.dockerfilePath,
        build_context: data.buildContext,
        container_port:
          data.siteType === "telegram_bot" ? undefined : data.containerPort,
        docker_network_host: data.dockerNetworkHost,
        nginx_ssl_enabled:
          data.siteType === "web" ? data.nginxSslEnabled : false,
        nginx_force_https:
          data.siteType === "web" ? data.nginxForceHttps : false,
        domains,
        env_vars: data.envVars.filter((e) => e.key.trim()),
      });

      const secrets: Record<string, string> = {};
      for (const s of data.secrets) {
        const key = s.key.trim();
        if (key && s.value) secrets[key] = s.value;
      }
      if (Object.keys(secrets).length > 0) {
        await api.setSecrets(site.id, secrets);
      }

      await api.deploySite(site.id);
      router.push(`/sites/${site.id}/deployments`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to create site");
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h1>New site</h1>
      <div className="wizard-steps">
        {steps.map((label, i) => (
          <span
            key={label}
            className={`wizard-step ${i === step ? "active" : ""} ${i < step ? "done" : ""}`}
          >
            {i + 1}. {label}
          </span>
        ))}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        {stepKey === "Basic" && <StepBasic data={data} update={update} />}
        {stepKey === "Repository" && <StepRepo data={data} update={update} />}
        {stepKey === "Docker" && <StepDocker data={data} update={update} />}
        {stepKey === "Environment" && <StepEnv data={data} update={update} />}
        {stepKey === "Nginx & SSL" && <StepNginx data={data} update={update} />}
        {stepKey === "Review" && <StepReview data={data} />}
      </div>

      <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
        {step > 0 && (
          <button type="button" className="btn btn-secondary" onClick={back}>
            Back
          </button>
        )}
        {step < steps.length - 1 ? (
          <button type="button" className="btn" onClick={next}>
            Continue
          </button>
        ) : (
          <button
            type="button"
            className="btn"
            onClick={handleDeploy}
            disabled={submitting}
          >
            {submitting ? "Deploying…" : "Create & deploy"}
          </button>
        )}
        <Link href="/sites" className="btn btn-secondary">
          Cancel
        </Link>
      </div>
    </div>
  );
}

function StepBasic({
  data,
  update,
}: {
  data: WizardState;
  update: (p: Partial<WizardState>) => void;
}) {
  return (
    <>
      <h2>Basic settings</h2>
      <div className="field">
        <label className="label">Type</label>
        <select
          className="input"
          value={data.siteType}
          onChange={(e) =>
            update({ siteType: e.target.value as WizardState["siteType"] })
          }
        >
          <option value="web">Website (nginx + SSL)</option>
          <option value="telegram_bot">Telegram bot (Docker only)</option>
        </select>
      </div>
      <div className="field">
        <label className="label">Name</label>
        <input
          className="input"
          value={data.name}
          onChange={(e) => update({ name: e.target.value })}
          placeholder={data.siteType === "telegram_bot" ? "My Bot" : "My App"}
        />
      </div>
      <div className="field">
        <label className="label">Slug (optional)</label>
        <input
          className="input"
          value={data.slug}
          onChange={(e) => update({ slug: e.target.value })}
          placeholder="my-app"
        />
      </div>
      {data.siteType === "web" && (
        <div className="field">
          <label className="label">Primary URL</label>
          <input
            className="input"
            value={data.primaryUrl}
            onChange={(e) => update({ primaryUrl: e.target.value })}
            placeholder="https://app.example.com"
          />
        </div>
      )}
      {data.siteType === "telegram_bot" && (
        <p style={{ color: "var(--muted)", fontSize: "0.875rem", margin: 0 }}>
          Bot runs in Docker with long polling — no domain or nginx required.
          Put <code>BOT_TOKEN</code> in secrets on the next steps.
        </p>
      )}
    </>
  );
}

function StepRepo({
  data,
  update,
}: {
  data: WizardState;
  update: (p: Partial<WizardState>) => void;
}) {
  return (
    <>
      <h2>Source repository</h2>
      <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>
        Public repos work without credentials. For private GitHub repos add a secret on
        the next step: <code>GIT_TOKEN</code> (HTTPS + PAT) or{" "}
        <code>GIT_SSH_KEY</code> (SSH URL <code>git@github.com:…</code>).
      </p>
      <div className="field">
        <label className="label">Git repository URL</label>
        <input
          className="input"
          value={data.gitRepoUrl}
          onChange={(e) => update({ gitRepoUrl: e.target.value })}
          placeholder="https://github.com/org/repo.git"
        />
      </div>
      <div className="field">
        <label className="label">Branch</label>
        <input
          className="input"
          value={data.gitBranch}
          onChange={(e) => update({ gitBranch: e.target.value })}
        />
      </div>
    </>
  );
}

function StepDocker({
  data,
  update,
}: {
  data: WizardState;
  update: (p: Partial<WizardState>) => void;
}) {
  return (
    <>
      <h2>Docker settings</h2>
      <div className="grid-2">
        <div className="field">
          <label className="label">Dockerfile path</label>
          <input
            className="input"
            value={data.dockerfilePath}
            onChange={(e) => update({ dockerfilePath: e.target.value })}
          />
        </div>
        <div className="field">
          <label className="label">Build context</label>
          <input
            className="input"
            value={data.buildContext}
            onChange={(e) => update({ buildContext: e.target.value })}
          />
        </div>
      </div>
      {data.siteType === "web" && (
        <div className="field">
          <label className="label">
            Container port (inside the image: EXPOSE / listen port)
          </label>
          <input
            className="input"
            type="number"
            value={data.containerPort}
            onChange={(e) =>
              update({ containerPort: parseInt(e.target.value, 10) || 3000 })
            }
          />
        </div>
      )}
      <label style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start", marginTop: "0.5rem" }}>
        <input
          type="checkbox"
          checked={data.dockerNetworkHost}
          onChange={(e) => update({ dockerNetworkHost: e.target.checked })}
          style={{ marginTop: "0.2rem" }}
        />
        <span>
          <strong>Host network</strong> (<code>network_mode: host</code>) — container
          shares the VPS network stack. No port mapping; nginx proxies to container port
          on localhost.
        </span>
      </label>
    </>
  );
}

function StepEnv({
  data,
  update,
}: {
  data: WizardState;
  update: (p: Partial<WizardState>) => void;
}) {
  return (
    <>
      <h2>Environment & secrets</h2>
      <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>
        {data.siteType === "telegram_bot"
          ? "Add BOT_TOKEN as a secret (recommended) or env var."
          : "For private GitHub: add secret GIT_TOKEN (PAT) or GIT_SSH_KEY (deploy key). Other secrets are encrypted and never shown again."}
      </p>

      <h3 style={{ marginTop: "1.5rem" }}>Environment variables</h3>
      <EnvVarList
        envVars={data.envVars}
        onChange={(envVars) => update({ envVars })}
      />

      <h3 style={{ marginTop: "1.5rem" }}>Secrets</h3>
      <KeyValueEditor
        rows={data.secrets}
        onChange={(secrets) => update({ secrets })}
        valueInputType="password"
        keyPlaceholder="GIT_TOKEN"
        valuePlaceholder="secret value"
        addLabel="Add secret"
      />
    </>
  );
}

function StepNginx({
  data,
  update,
}: {
  data: WizardState;
  update: (p: Partial<WizardState>) => void;
}) {
  return (
    <>
      <h2>Nginx & SSL</h2>
      <div className="field">
        <label className="label">Domain aliases (one per line)</label>
        <textarea
          className="textarea"
          value={data.aliases.join("\n")}
          onChange={(e) =>
            update({
              aliases: e.target.value.split("\n").filter(Boolean),
            })
          }
          placeholder="www.example.com"
        />
      </div>
      <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <input
          type="checkbox"
          checked={data.nginxSslEnabled}
          onChange={(e) => update({ nginxSslEnabled: e.target.checked })}
        />
        Enable SSL (certbot)
      </label>
      <label
        style={{
          display: "flex",
          gap: "0.5rem",
          alignItems: "center",
          marginTop: "0.5rem",
        }}
      >
        <input
          type="checkbox"
          checked={data.nginxForceHttps}
          onChange={(e) => update({ nginxForceHttps: e.target.checked })}
        />
        Force HTTPS redirect
      </label>
    </>
  );
}

function StepReview({ data }: { data: WizardState }) {
  return (
    <>
      <h2>Review</h2>
      <dl style={{ margin: 0 }}>
        <ReviewRow
          label="Type"
          value={data.siteType === "telegram_bot" ? "Telegram bot" : "Website"}
        />
        <ReviewRow label="Name" value={data.name} />
        {data.siteType === "web" && (
          <ReviewRow label="Primary URL" value={data.primaryUrl} />
        )}
        <ReviewRow label="Repository" value={data.gitRepoUrl} />
        <ReviewRow label="Branch" value={data.gitBranch} />
        <ReviewRow
          label="Docker"
          value={
            data.siteType === "telegram_bot"
              ? data.dockerfilePath
              : `${data.dockerfilePath} (port ${data.containerPort})`
          }
        />
        <ReviewRow
          label="Env vars"
          value={String(data.envVars.filter((e) => e.key).length)}
        />
        <ReviewRow
          label="Secrets"
          value={String(data.secrets.filter((s) => s.key.trim()).length)}
        />
        <ReviewRow
          label="SSL"
          value={data.nginxSslEnabled ? "Enabled" : "Disabled"}
        />
      </dl>
    </>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: "0.5rem" }}>
      <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>{label}</span>
      <div>{value || "—"}</div>
    </div>
  );
}
