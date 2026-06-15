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
    <nav
      className="site-tabs"
      aria-label="Site sections"
      style={{
        display: "flex",
        gap: "0.25rem",
        marginBottom: "1.5rem",
        flexWrap: "wrap",
        borderBottom: "1px solid var(--border)",
        paddingBottom: "0.5rem",
      }}
    >
      {tabs.map((tab) => {
        const isActive = active === tab.key;
        return (
          <Link
            key={tab.key}
            href={tab.href(siteId)}
            className={isActive ? "site-tab site-tab-active" : "site-tab"}
            style={{
              display: "inline-block",
              padding: "0.35rem 0.75rem",
              borderRadius: "var(--radius)",
              fontWeight: isActive ? 600 : 500,
              fontSize: "0.875rem",
              color: isActive ? "var(--text)" : "var(--muted)",
              background: isActive ? "var(--surface-hover)" : "transparent",
              border: isActive ? "1px solid var(--border)" : "1px solid transparent",
            }}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
