"use client";

import { usePathname } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { Nav } from "@/components/Nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublicAuth = pathname?.startsWith("/auth/mobile");

  if (isPublicAuth) {
    return <>{children}</>;
  }

  return (
    <AuthGate>
      <Nav />
      <main>{children}</main>
    </AuthGate>
  );
}
