"use client";

import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { api, createQRSessionWithToken } from "@/lib/api";
import { useI18n } from "@/lib/i18n/context";

type MobileQrModalProps = {
  open: boolean;
  onClose: () => void;
  /** Use token from login form before session is saved. */
  provisionalToken?: string;
};

function mobileAuthURL(code: string): string {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/auth/mobile?code=${encodeURIComponent(code)}`;
}

function formatCountdown(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "0:00";
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

export function MobileQrModal({
  open,
  onClose,
  provisionalToken,
}: MobileQrModalProps) {
  const { t } = useI18n();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [countdown, setCountdown] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadQR = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const session = provisionalToken
        ? await createQRSessionWithToken(provisionalToken)
        : await api.createQRSession();
      const url = mobileAuthURL(session.code);
      const dataUrl = await QRCode.toDataURL(url, {
        margin: 2,
        width: 280,
        color: { dark: "#0f172a", light: "#ffffff" },
      });
      setQrDataUrl(dataUrl);
      setExpiresAt(session.expires_at);
      setCountdown(formatCountdown(session.expires_at));
    } catch (err) {
      let message = err instanceof Error ? err.message : "Error";
      if (message === "qr auth migration required") {
        message = t("mobileQr.migrationRequired");
      }
      setError(message);
      setQrDataUrl(null);
      setExpiresAt(null);
    } finally {
      setLoading(false);
    }
  }, [provisionalToken]);

  useEffect(() => {
    if (!open) {
      setQrDataUrl(null);
      setExpiresAt(null);
      setError(null);
      return;
    }
    void loadQR();
  }, [open, loadQR]);

  useEffect(() => {
    if (!open || !expiresAt) return;

    const tick = () => {
      const ms = new Date(expiresAt).getTime() - Date.now();
      if (ms <= 0) {
        setCountdown("0:00");
        return;
      }
      setCountdown(formatCountdown(expiresAt));
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [open, expiresAt]);

  if (!open) return null;

  const expired = expiresAt ? new Date(expiresAt).getTime() <= Date.now() : false;

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal card mobile-qr-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="mobile-qr-title"
      >
        <h2 id="mobile-qr-title">{t("mobileQr.title")}</h2>
        <p className="mobile-qr-hint">{t("mobileQr.hint")}</p>

        {loading && <p className="mobile-qr-status">{t("common.loading")}</p>}
        {error && <div className="alert alert-error">{error}</div>}

        {qrDataUrl && !loading && (
          <>
            <img
              className="mobile-qr-image"
              src={qrDataUrl}
              alt={t("mobileQr.qrAlt")}
              width={280}
              height={280}
            />
            <p className="mobile-qr-expires">
              {expired
                ? t("mobileQr.expired")
                : t("mobileQr.expiresIn", { time: countdown })}
            </p>
          </>
        )}

        <div className="mobile-qr-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void loadQR()}
            disabled={loading}
          >
            {t("common.refresh")}
          </button>
          <button type="button" className="btn" onClick={onClose}>
            {t("common.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
