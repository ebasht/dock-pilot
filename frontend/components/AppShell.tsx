"use client";

import { AuthGate } from "@/components/AuthGate";
import { Nav } from "@/components/Nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <Nav />
      <main>{children}</main>
    </AuthGate>
  );
}
