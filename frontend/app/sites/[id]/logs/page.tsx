"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ContainerLogStream } from "@/components/ContainerLogStream";
import { SiteTabs } from "@/components/SiteTabs";
import { api, ApiError } from "@/lib/api";
import type { Site } from "@/lib/types";

export default function SiteLogsPage() {
  const { id } = useParams<{ id: string }>();
  const [site, setSite] = useState<Site | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getSite(id)
      .then(setSite)
      .catch((e) => {
        setError(e instanceof ApiError ? e.message : "Failed to load site");
      });
  }, [id]);

  if (error) {
    return <div className="alert alert-error">{error}</div>;
  }

  if (!site) {
    return <p style={{ color: "var(--muted)" }}>Loading…</p>;
  }

  const kind = site.site_type === "telegram_bot" ? "bot" : "site";

  return (
    <div>
      <h1>{site.name}</h1>
      <p style={{ color: "var(--muted)", margin: "0 0 1rem" }}>
        Live stdout / stderr from the Docker {kind} container
      </p>

      <SiteTabs siteId={id} active="logs" />

      <div className="card">
        <p style={{ color: "var(--muted)", fontSize: "0.875rem", margin: "0 0 0.75rem" }}>
          Same output as <code>docker logs -f</code>. Deploy the {kind} first if the
          container is missing.
        </p>
        <ContainerLogStream siteId={id} />
      </div>

      <Link
        href={`/sites/${id}`}
        style={{ display: "inline-block", marginTop: "1rem", fontSize: "0.875rem" }}
      >
        ← Back to overview
      </Link>
    </div>
  );
}
