"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AUTH_LOGOUT_EVENT,
  clearApiToken,
  getApiToken,
  setApiToken,
} from "@/lib/auth-token";
import { getApiBase, verifyApiToken } from "@/lib/api";
import { AppVersion } from "@/components/AppVersion";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [apiBase, setApiBase] = useState("");

  useEffect(() => {
    setAuthed(!!getApiToken());
    setApiBase(getApiBase());
    setReady(true);

    const onLogout = () => setAuthed(false);
    window.addEventListener(AUTH_LOGOUT_EVENT, onLogout);
    return () => window.removeEventListener(AUTH_LOGOUT_EVENT, onLogout);
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      const token = tokenInput.trim();
      if (!token) {
        setError("Enter API token");
        return;
      }

      setSubmitting(true);
      try {
        const result = await verifyApiToken(token);
        if (!result.ok) {
          if (result.reason === "invalid_token") {
            setError("Invalid API token");
          } else {
            setError(
              `Cannot reach API at ${getApiBase()}. ${result.message}. ` +
                "Check DNS, nginx, and that the API container is running.",
            );
          }
          return;
        }
        setApiToken(token);
        setAuthed(true);
        setTokenInput("");
      } finally {
        setSubmitting(false);
      }
    },
    [tokenInput],
  );

  if (!ready) {
    return null;
  }

  if (!authed) {
    return (
      <div className="auth-screen">
        <div className="card auth-card">
          <h1>
            DockPilot <AppVersion />
          </h1>
          <p className="auth-hint">
            Enter the API token to access the control panel. The token is stored
            in this browser session only.
          </p>
          <p className="auth-api-url">
            API: <code>{apiBase || getApiBase()}</code>
          </p>
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label className="label" htmlFor="api-token">
                API token
              </label>
              <input
                id="api-token"
                className="input"
                type="password"
                autoComplete="off"
                autoFocus
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Value from API_TOKEN in server .env"
              />
            </div>
            {error && <div className="alert alert-error">{error}</div>}
            <button type="submit" className="btn" disabled={submitting}>
              {submitting ? "Checking…" : "Continue"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export function useLogout() {
  return useCallback(() => {
    clearApiToken();
    window.dispatchEvent(new Event(AUTH_LOGOUT_EVENT));
  }, []);
}
