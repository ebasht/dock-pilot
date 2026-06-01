"use client";

import Link from "next/link";
import { useLogout } from "@/components/AuthGate";

export function Nav() {
  const logout = useLogout();

  return (
    <nav className="nav">
      <Link href="/sites" className="nav-brand">
        DockPilot
      </Link>
      <div className="nav-links">
        <Link href="/sites">Sites</Link>
        <Link href="/sites/new">New site</Link>
        <button type="button" className="btn btn-secondary nav-logout" onClick={logout}>
          Log out
        </button>
      </div>
    </nav>
  );
}
