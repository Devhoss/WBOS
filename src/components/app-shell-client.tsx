"use client";

import { useSidebar } from "./sidebar-context";
import { Sidebar } from "./sidebar";
import { MobileNav } from "./mobile-nav";
import { SignOutButton } from "./sign-out-button";
import { ThemeToggle } from "./theme-toggle";

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

      <div className="main-area pl-[var(--sidebar-width)] transition-[padding] duration-200 ease-in-out lg:pt-0">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur lg:h-16 lg:px-8">
          <div className="flex items-center gap-2 min-w-0">
            <MobileNav
              organizationName={organizationName}
              logoPath={logoPath}
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{organizationName}</p>
              <p className="hidden truncate text-xs text-muted-foreground sm:block">
                Wholesale Operations
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />
            <SignOutButton />
          </div>
        </header>

        <main className="min-h-[calc(100vh-3.5rem)] px-4 py-6 lg:min-h-[calc(100vh-4rem)] lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
