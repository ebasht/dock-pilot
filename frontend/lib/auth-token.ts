const STORAGE_KEY = "dock-pilot-api-token";

export function getApiToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(STORAGE_KEY);
}

export function setApiToken(token: string): void {
  sessionStorage.setItem(STORAGE_KEY, token.trim());
}

export function clearApiToken(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}

export const AUTH_LOGOUT_EVENT = "dock-pilot-auth-logout";

export function notifyAuthLogout(): void {
  window.dispatchEvent(new Event(AUTH_LOGOUT_EVENT));
}
