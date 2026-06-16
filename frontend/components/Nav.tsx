"use client";

import Link from "next/link";
import { AppVersion } from "@/components/AppVersion";
import { useLogout } from "@/components/AuthGate";

export function Nav() {
  const logout = useLogout();

  return (
    <nav className="nav">
      <Link href="/sites" className="nav-brand">
        DockPilot <AppVersion />
      </Link>
      <div className="nav-links">
        <Link href="/sites">Sites</Link>
        <Link href="/notifications">Уведомления</Link>
        <Link href="/sites/new">New site</Link>
        <button type="button" className="btn btn-secondary nav-logout" onClick={logout}>
          Log out
        </button>
      </div>
    </nav>
  );
}
