"use client";

import { useSidebar } from "./sidebar-context";
import { Sidebar } from "./sidebar";

export function AppShellClient({
  organizationName,
  logoPath,
  children,
}: {
  organizationName: string;
  logoPath?: string | null;
  children: React.ReactNode;
}) {
  const { collapsed } = useSidebar();

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        organizationName={organizationName}
        logoPath={logoPath}
        collapsed={collapsed}
      />
      <div
        className="transition-[padding] duration-200 ease-in-out"
        style={{ paddingLeft: collapsed ? 64 : 256 }}
      >
        {children}
      </div>
    </div>
  );
}
