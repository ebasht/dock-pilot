"use client";

import { useI18n } from "@/lib/i18n/context";

export function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const key = status.toLowerCase();
  const label =
    key === "active" ||
    key === "pending" ||
    key === "running" ||
    key === "succeeded" ||
    key === "failed" ||
    key === "cancelled"
      ? t(`status.${key}`)
      : status;
  return <span className={`badge badge-${key}`}>{label}</span>;
}
