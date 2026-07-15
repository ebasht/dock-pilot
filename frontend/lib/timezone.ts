/** IANA timezone of the current browser, or UTC. */
export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** Curated fallback when Intl.supportedValuesOf is unavailable. */
const COMMON_TIMEZONES = [
  "UTC",
  "Europe/Kaliningrad",
  "Europe/Moscow",
  "Europe/Samara",
  "Asia/Yekaterinburg",
  "Asia/Omsk",
  "Asia/Novosibirsk",
  "Asia/Barnaul",
  "Asia/Tomsk",
  "Asia/Krasnoyarsk",
  "Asia/Irkutsk",
  "Asia/Yakutsk",
  "Asia/Vladivostok",
  "Asia/Magadan",
  "Asia/Kamchatka",
  "Europe/Kyiv",
  "Europe/Minsk",
  "Europe/Berlin",
  "Europe/London",
  "Europe/Paris",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Almaty",
  "Asia/Tashkent",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
] as const;

/**
 * Timezones for the digest picker: full IANA list when the browser supports it,
 * otherwise a curated fallback that always includes the browser and stored zones.
 */
export function listTimezones(...extra: string[]): string[] {
  let zones: string[] = [];
  try {
    const supported = (
      Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
    ).supportedValuesOf?.("timeZone");
    if (supported?.length) {
      zones = [...supported];
    }
  } catch {
    /* ignore */
  }
  if (zones.length === 0) {
    zones = [...COMMON_TIMEZONES];
  }

  const set = new Set(zones);
  for (const z of [browserTimezone(), ...extra]) {
    const t = z?.trim();
    if (t) set.add(t);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export function resolveDigestTimezone(stored?: string): string {
  const tz = stored?.trim();
  if (!tz || tz === "UTC") return browserTimezone();
  return tz;
}
