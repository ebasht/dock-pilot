"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { KeyValueEditor } from "@/components/KeyValueEditor";
import { SiteTabs } from "@/components/SiteTabs";
import { api, ApiError } from "@/lib/api";
import type { EnvVar, SecretMeta, Site } from "@/lib/types";

export default function SiteSecretsPage() {
  const { id } = useParams<{ id: string }>();
  const [site, setSite] = useState<Site | null>(null);
  const [secrets, setSecrets] = useState<SecretMeta[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<EnvVar[]>([{ key: "", value: "" }]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, sec] = await Promise.all([
        api.getSite(id),
        api.listSecrets(id),
      ]);
      setSite(s);
      setSecrets(sec);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const toSave = draft.filter((row) => row.key.trim() && row.value);
    if (toSave.length === 0) return;

    setSaving(true);
    setError(null);
    try {
      for (const row of toSave) {
        await api.upsertSecret(id, row.key.trim(), row.value);
      }
      setDraft([{ key: "", value: "" }]);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save secret");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (key: string) => {
    if (!confirm(`Delete secret "${key}"?`)) return;
    try {
      await api.deleteSecret(id, key);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete");
    }
  };

  return (
    <div>
      <h1>{site?.name ?? "Secrets"}</h1>
      <SiteTabs siteId={id} active="secrets" />

      <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>
        Secret values are encrypted at rest and are never returned after saving.
        Private GitHub: <code>GIT_TOKEN</code> / <code>GITHUB_TOKEN</code> (PAT + HTTPS
        URL) or <code>GIT_SSH_KEY</code> (deploy key + <code>git@github.com:…</code>).
      </p>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h2>Stored secrets</h2>
        {secrets.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>No secrets configured.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {secrets.map((s, idx) => (
                <tr key={s.key || `secret-${idx}`}>
                  <td>
                    <code>{s.key || "(missing name — re-add below)"}</code>
                  </td>
                  <td>{new Date(s.updated_at).toLocaleString()}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-danger"
                      style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                      onClick={() => handleDelete(s.key)}
                      disabled={!s.key}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <form onSubmit={handleAdd} className="card">
        <h2>Add or rotate secret</h2>
        <p style={{ color: "var(--muted)", fontSize: "0.875rem", marginBottom: "0.75rem" }}>
          Two fields per secret: <strong>Name</strong> (e.g. <code>BOT_TOKEN</code>) and{" "}
          <strong>Value</strong>.
        </p>
        <KeyValueEditor
          rows={draft}
          onChange={setDraft}
          valueInputType="password"
          keyPlaceholder="BOT_TOKEN"
          valuePlaceholder="secret value"
          addLabel="Add another secret"
        />
        <button type="submit" className="btn" disabled={saving}>
          {saving ? "Saving…" : "Save secret(s)"}
        </button>
      </form>
    </div>
  );
}
