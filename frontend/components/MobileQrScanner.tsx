"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { useI18n } from "@/lib/i18n/context";
import { parseQrAuthCode } from "@/lib/qr-auth-code";

type MobileQrScannerProps = {
  open: boolean;
  onClose: () => void;
  onScan: (code: string) => void | Promise<void>;
};

export function MobileQrScanner({ open, onClose, onScan }: MobileQrScannerProps) {
  const { t } = useI18n();
  const readerId = useId().replace(/:/g, "");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handlingRef = useRef(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (!scanner) return;
    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }
      scanner.clear();
    } catch {
      /* ignore cleanup errors */
    }
  }, []);

  useEffect(() => {
    if (!open) {
      void stopScanner();
      setCameraError(null);
      setScanError(null);
      handlingRef.current = false;
      return;
    }

    let cancelled = false;
    const scanner = new Html5Qrcode(readerId);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (text) => {
          if (cancelled || handlingRef.current) return;

          const code = parseQrAuthCode(text);
          if (!code) {
            setScanError(t("qrScanner.invalidQr"));
            return;
          }

          handlingRef.current = true;
          setScanError(null);
          void (async () => {
            try {
              await stopScanner();
              await onScan(code);
            } catch {
              handlingRef.current = false;
            }
          })();
        },
        () => {
          /* per-frame decode miss */
        },
      )
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : t("qrScanner.cameraDenied");
        setCameraError(message);
      });

    return () => {
      cancelled = true;
      void stopScanner();
    };
  }, [open, readerId, onScan, stopScanner, t]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal card mobile-qr-scanner"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="qr-scanner-title"
      >
        <h2 id="qr-scanner-title">{t("qrScanner.title")}</h2>
        <p className="mobile-qr-hint">{t("qrScanner.hint")}</p>

        {cameraError && <div className="alert alert-error">{cameraError}</div>}
        {scanError && <div className="alert alert-error">{scanError}</div>}

        <div id={readerId} className="qr-scanner-viewport" />

        <div className="mobile-qr-actions">
          <button type="button" className="btn" onClick={onClose}>
            {t("common.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
