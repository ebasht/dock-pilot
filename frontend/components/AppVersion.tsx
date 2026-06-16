import { getAppVersion } from "@/lib/version";

export function AppVersion() {
  const version = getAppVersion();
  if (!version) return null;
  return <span className="app-version">{version}</span>;
}
