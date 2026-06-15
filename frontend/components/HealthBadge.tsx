export type HealthOverall = "healthy" | "degraded" | "unhealthy" | "unknown";

const labels: Record<HealthOverall, string> = {
  healthy: "Healthy",
  degraded: "Degraded",
  unhealthy: "Unhealthy",
  unknown: "Unknown",
};

export function HealthBadge({ overall }: { overall: string }) {
  const key = (overall?.toLowerCase() || "unknown") as HealthOverall;
  const cls = `badge badge-health-${key in labels ? key : "unknown"}`;
  return <span className={cls}>{labels[key in labels ? key : "unknown"]}</span>;
}
