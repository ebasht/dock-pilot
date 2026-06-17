/** Extract one-time auth code from a scanned QR payload. */
export function parseQrAuthCode(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    const code = url.searchParams.get("code")?.trim();
    if (code && url.pathname.includes("/auth/mobile")) {
      return code;
    }
  } catch {
    /* not a URL */
  }

  if (/^[a-f0-9]{48}$/i.test(trimmed)) {
    return trimmed;
  }

  return null;
}
