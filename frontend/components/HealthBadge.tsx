"use client";

import { useI18n } from "@/lib/i18n/context";

export type HealthOverall = "healthy" | "degraded" | "unhealthy" | "unknown";

export function HealthBadge({ overall }: { overall: string }) {
  const { t } = useI18n();
  const key = (overall?.toLowerCase() || "unknown") as HealthOverall;
  const known: HealthOverall[] = ["healthy", "degraded", "unhealthy", "unknown"];
  const safe = known.includes(key) ? key : "unknown";
  return <span className={`badge badge-health-${safe}`}>{t(`health.${safe}`)}</span>;
}
