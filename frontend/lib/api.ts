import {
  clearApiToken,
  getApiToken,
  notifyAuthLogout,
} from "./auth-token";
import { normalizeSecretMeta, normalizeSite } from "./normalize";
import type {
  ContainerActionResult,
  CreateSiteRequest,
  Deployment,
  NotificationSettings,
  SecretMeta,
  Site,
  SiteHealth,
  SiteListItem,
  UpdateNotificationSettings,
} from "./types";

import { resolveApiBase } from "./api-base";

/** Browser: resolved at call time (supports auto/same-origin). SSR/build: env or localhost. */
export function getApiBase(): string {
  return resolveApiBase();
}

// Legacy export for modules that read once at module load (prefer getApiBase() in client code).
export const API_BASE = resolveApiBase();

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function authHeaders(): HeadersInit {
  const token = getApiToken();
  if (!token) {
    return {};
  }
  return {
    Authorization: `Bearer ${token}`,
  };
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${getApiBase()}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    clearApiToken();
    notifyAuthLogout();
    throw new ApiError("Invalid or missing API token", 401);
  }

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* ignore */
    }
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

function streamURL(path: string): string {
  const url = new URL(`${getApiBase()}${path}`);
  const token = getApiToken();
  if (token) {
    url.searchParams.set("token", token);
  }
  return url.toString();
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: "invalid_token" }
  | { ok: false; reason: "network"; message: string };

/** Check token against the API before saving it in the browser. */
export async function verifyApiToken(token: string): Promise<VerifyResult> {
  try {
    const res = await fetch(`${getApiBase()}/api/sites`, {
      headers: {
        Authorization: `Bearer ${token.trim()}`,
      },
    });
    if (res.status === 401) {
      return { ok: false, reason: "invalid_token" };
    }
    if (!res.ok) {
      return { ok: false, reason: "network", message: `API returned ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error";
    return { ok: false, reason: "network", message };
  }
}

export const api = {
  listSites: () => request<SiteListItem[]>("/api/sites"),

  listSitesHealth: () => request<SiteHealth[]>("/api/sites/health"),

  getSiteHealth: (id: string) => request<SiteHealth>(`/api/sites/${id}/health`),

  streamSiteContainerLogs: (siteId: string, tail = 300) =>
    new EventSource(
      streamURL(`/api/sites/${siteId}/logs/stream?tail=${tail}`),
    ),

  getSite: (id: string) =>
    request<Site>(`/api/sites/${id}`).then(normalizeSite),

  createSite: (body: CreateSiteRequest) =>
    request<Site>("/api/sites", {
      method: "POST",
      body: JSON.stringify(body),
    }).then(normalizeSite),

  updateSite: (id: string, body: Partial<CreateSiteRequest>) =>
    request<Site>(`/api/sites/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }).then(normalizeSite),

  deleteSite: (id: string) =>
    request<void>(`/api/sites/${id}`, { method: "DELETE" }),

  deploySite: (id: string) =>
    request<Deployment>(`/api/sites/${id}/deploy`, { method: "POST" }),

  listDeployments: (siteId: string) =>
    request<Deployment[]>(`/api/sites/${siteId}/deployments`),

  listSecrets: (siteId: string) =>
    request<SecretMeta[]>(`/api/sites/${siteId}/secrets`).then((rows) =>
      rows.map(normalizeSecretMeta),
    ),

  setSecrets: (siteId: string, secrets: Record<string, string>) =>
    request<SecretMeta[]>(`/api/sites/${siteId}/secrets`, {
      method: "POST",
      body: JSON.stringify({ secrets }),
    }),

  upsertSecret: (siteId: string, key: string, value: string) =>
    request<SecretMeta>(`/api/sites/${siteId}/secrets/${encodeURIComponent(key)}`, {
      method: "PUT",
      body: JSON.stringify({ value }),
    }),

  deleteSecret: (siteId: string, key: string) =>
    request<void>(
      `/api/sites/${siteId}/secrets/${encodeURIComponent(key)}`,
      { method: "DELETE" },
    ),

  streamDeploymentLogs: (deploymentId: string) =>
    new EventSource(
      streamURL(`/api/deployments/${deploymentId}/logs/stream`),
    ),

  getNotificationSettings: () =>
    request<NotificationSettings>("/api/notifications/settings"),

  updateNotificationSettings: (body: UpdateNotificationSettings) =>
    request<NotificationSettings>("/api/notifications/settings", {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  sendNotificationTest: () =>
    request<{ status: string }>("/api/notifications/test", { method: "POST" }),

  startSiteContainer: (id: string) =>
    request<ContainerActionResult>(`/api/sites/${id}/container/start`, { method: "POST" }),

  stopSiteContainer: (id: string) =>
    request<ContainerActionResult>(`/api/sites/${id}/container/stop`, { method: "POST" }),

  restartSiteContainer: (id: string) =>
    request<ContainerActionResult>(`/api/sites/${id}/container/restart`, { method: "POST" }),

  createQRSession: () =>
    request<{ code: string; expires_at: string }>("/api/auth/qr", { method: "POST" }),
};

export async function exchangeQRCode(code: string): Promise<string> {
  const res = await fetch(`${getApiBase()}/api/auth/qr/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* ignore */
    }
    throw new ApiError(message, res.status);
  }

  const body = (await res.json()) as { token: string };
  return body.token;
}

export async function createQRSessionWithToken(
  token: string,
): Promise<{ code: string; expires_at: string }> {
  const res = await fetch(`${getApiBase()}/api/auth/qr`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token.trim()}`,
    },
  });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* ignore */
    }
    throw new ApiError(message, res.status);
  }

  return res.json() as Promise<{ code: string; expires_at: string }>;
}
