"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AUTH_LOGOUT_EVENT,
  clearApiToken,
  getApiToken,
  setApiToken,
} from "@/lib/auth-token";
import { getApiBase, verifyApiToken } from "@/lib/api";
import { BrandLogo } from "@/components/BrandLogo";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { MobileQrModal } from "@/components/MobileQrModal";
import { useI18n } from "@/lib/i18n/context";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrToken, setQrToken] = useState<string | null>(null);

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
        setError(t("auth.enterToken"));
        return;
      }

      setSubmitting(true);
      try {
        const result = await verifyApiToken(token);
        if (!result.ok) {
          if (result.reason === "invalid_token") {
            setError(t("auth.invalidToken"));
          } else {
            setError(
              t("auth.cannotReachApi", {
                apiBase: getApiBase(),
                message: result.message,
              }),
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
    [tokenInput, t],
  );

  const handleShowQr = useCallback(async () => {
    setError(null);
    const token = tokenInput.trim();
    if (!token) {
      setError(t("auth.enterToken"));
      return;
    }

    setSubmitting(true);
    try {
      const result = await verifyApiToken(token);
      if (!result.ok) {
        if (result.reason === "invalid_token") {
          setError(t("auth.invalidToken"));
        } else {
          setError(
            t("auth.cannotReachApi", {
              apiBase: getApiBase(),
              message: result.message,
            }),
          );
        }
        return;
      }
      setQrToken(token);
      setQrOpen(true);
    } finally {
      setSubmitting(false);
    }
  }, [tokenInput, t]);

  if (!ready) {
    return null;
  }

  if (!authed) {
    return (
      <>
        <div className="auth-screen">
          <div className="card auth-card">
          <LocaleSwitcher className="auth-locale" />
          <h1 className="auth-brand">
            <BrandLogo showVersion size="auth" />
          </h1>
          <p className="auth-hint">{t("auth.hint")}</p>
          <p className="auth-api-url">
            {t("auth.apiLabel")}: <code>{apiBase || getApiBase()}</code>
          </p>
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label className="label" htmlFor="api-token">
                {t("auth.tokenLabel")}
              </label>
              <input
                id="api-token"
                className="input"
                type="password"
                autoComplete="off"
                autoFocus
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder={t("auth.tokenPlaceholder")}
              />
            </div>
            {error && <div className="alert alert-error">{error}</div>}
            <div className="auth-actions">
              <button type="submit" className="btn" disabled={submitting}>
                {submitting ? t("auth.checking") : t("common.continue")}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={submitting}
                onClick={() => void handleShowQr()}
              >
                {t("auth.showQr")}
              </button>
            </div>
          </form>
          </div>
        </div>
        <MobileQrModal
          open={qrOpen}
          onClose={() => {
            setQrOpen(false);
            setQrToken(null);
          }}
          provisionalToken={qrToken ?? undefined}
        />
      </>
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
