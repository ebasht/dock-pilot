"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ContainerLogStream } from "@/components/ContainerLogStream";
import { SiteTabs } from "@/components/SiteTabs";
import { api, ApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n/context";
import type { Site } from "@/lib/types";

export default function SiteLogsPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const [site, setSite] = useState<Site | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getSite(id)
      .then(setSite)
      .catch((e) => {
        setError(e instanceof ApiError ? e.message : t("site.loadFailed"));
      });
  }, [id, t]);

  if (error) {
    return <div className="alert alert-error">{error}</div>;
  }

  if (!site) {
    return <p style={{ color: "var(--muted)" }}>{t("common.loading")}</p>;
  }

  const kind =
    site.site_type === "telegram_bot" ? t("siteLogs.kindBot") : t("siteLogs.kindSite");

  return (
    <div>
      <h1>{site.name}</h1>
      <p style={{ color: "var(--muted)", margin: "0 0 1rem" }}>
        {t("siteLogs.subtitle", { kind })}
      </p>

      <SiteTabs siteId={id} active="logs" />

      <div className="card">
        <p style={{ color: "var(--muted)", fontSize: "0.875rem", margin: "0 0 0.75rem" }}>
          {t("siteLogs.hint", {
            cmd: "docker logs -f",
            kind,
          })}
        </p>
        <ContainerLogStream siteId={id} />
      </div>

      <Link
        href={`/sites/${id}`}
        style={{ display: "inline-block", marginTop: "1rem", fontSize: "0.875rem" }}
      >
        {t("siteLogs.backToOverview")}
      </Link>
    </div>
  );
}
