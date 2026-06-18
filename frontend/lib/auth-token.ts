const STORAGE_KEY = "dock-pilot-api-token";

export function getApiToken(): string | null {
  if (typeof window === "undefined") return null;

  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return stored;

  // One-time migration from older sessionStorage-only builds.
  const legacy = sessionStorage.getItem(STORAGE_KEY);
  if (legacy) {
    localStorage.setItem(STORAGE_KEY, legacy);
    sessionStorage.removeItem(STORAGE_KEY);
    return legacy;
  }

  return null;
}

export function setApiToken(token: string): void {
  localStorage.setItem(STORAGE_KEY, token.trim());
  sessionStorage.removeItem(STORAGE_KEY);
}

export function clearApiToken(): void {
  localStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(STORAGE_KEY);
}

export const AUTH_LOGOUT_EVENT = "dock-pilot-auth-logout";

export function notifyAuthLogout(): void {
  window.dispatchEvent(new Event(AUTH_LOGOUT_EVENT));
}
