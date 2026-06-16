/** Baked at image build time (NEXT_PUBLIC_APP_VERSION). */
export function getAppVersion(): string {
  const raw = process.env.NEXT_PUBLIC_APP_VERSION?.trim();
  if (!raw) {
    return process.env.NODE_ENV === "development" ? "dev" : "";
  }
  return raw.startsWith("v") ? raw : `v${raw}`;
}
