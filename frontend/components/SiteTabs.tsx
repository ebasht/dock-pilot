import Link from "next/link";

const tabs = [
  { key: "overview", href: (id: string) => `/sites/${id}`, label: "Overview" },
  { key: "logs", href: (id: string) => `/sites/${id}/logs`, label: "Logs" },
  { key: "settings", href: (id: string) => `/sites/${id}/settings`, label: "Settings" },
  { key: "secrets", href: (id: string) => `/sites/${id}/secrets`, label: "Secrets" },
  {
    key: "deployments",
    href: (id: string) => `/sites/${id}/deployments`,
    label: "Deployments",
  },
];

export function SiteTabs({
  siteId,
  active,
}: {
  siteId: string;
  active: string;
}) {
  return (
    <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
      {tabs.map((tab) => {
        const isActive = active === tab.key;
        return (
          <Link
            key={tab.key}
            href={tab.href(siteId)}
            style={{
              fontWeight: isActive ? 600 : 400,
              color: isActive ? "var(--text)" : "var(--muted)",
            }}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
