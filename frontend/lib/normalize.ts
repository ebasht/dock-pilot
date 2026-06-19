import type { EnvVar, SecretMeta, Site } from "./types";

/** Accept API payloads whether fields are `key` or legacy `Key`. */
export function normalizeEnvVar(raw: EnvVar | Record<string, unknown>): EnvVar {
  const r = raw as Record<string, unknown>;
  return {
    key: String(r.key ?? r.Key ?? "").trim(),
    value: String(r.value ?? r.Value ?? ""),
  };
}

export function normalizeSecretMeta(raw: SecretMeta | Record<string, unknown>): SecretMeta {
  const r = raw as Record<string, unknown>;
  return {
    key: String(r.key ?? r.Key ?? "").trim(),
    created_at: String(r.created_at ?? r.CreatedAt ?? ""),
    updated_at: String(r.updated_at ?? r.UpdatedAt ?? ""),
  };
}

export function normalizeSite(site: Site): Site {
  return {
    ...site,
    env_vars: (site.env_vars ?? []).map(normalizeEnvVar),
    docker_volume_mounts: site.docker_volume_mounts ?? [],
    docker_named_volumes: site.docker_named_volumes ?? [],
    health_check_path: site.health_check_path ?? "",
  };
}
