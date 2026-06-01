import Link from "next/link";

const tabs = [
  { href: (id: string) => `/sites/${id}`, label: "Overview" },
  { href: (id: string) => `/sites/${id}/settings`, label: "Settings" },
  { href: (id: string) => `/sites/${id}/secrets`, label: "Secrets" },
  { href: (id: string) => `/sites/${id}/deployments`, label: "Deployments" },
];

export function SiteTabs({
  siteId,
  active,
}: {
  siteId: string;
  active: string;
}) {
  return (
    <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem" }}>
      {tabs.map((tab) => {
        const path = tab.href(siteId);
        const isActive = active === tab.label.toLowerCase() || 
          (active === "overview" && tab.label === "Overview");
        return (
          <Link
            key={tab.label}
            href={path}
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
