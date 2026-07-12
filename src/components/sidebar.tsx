"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect } from "react";

import { NavItems } from "./nav-items";
import { OrgBranding } from "./org-branding";
import { useSidebar } from "./sidebar-context";

export function Sidebar({
  organizationName,
  logoPath,
  collapsed,
}: {
  organizationName: string;
  logoPath?: string | null;
  collapsed: boolean;
}) {
  const { toggle } = useSidebar();

  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "b") {
        e.preventDefault();
        toggle();
      }
    }
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [toggle]);

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-30 hidden border-r bg-muted/40 transition-all duration-200 ease-in-out lg:flex lg:flex-col ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      <div
        className={`flex h-16 items-center gap-3 border-b ${
          collapsed ? "justify-center px-0" : "px-5"
        }`}
      >
        <OrgBranding name={organizationName} logoPath={logoPath} size={collapsed ? "sm" : "md"} />
        {!collapsed && (
          <div className="min-w-0 overflow-hidden">
            <p className="truncate text-sm font-semibold">{organizationName}</p>
            <p className="truncate text-xs text-muted-foreground">Wholesale Operations</p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        <NavItems collapsed={collapsed} />
      </nav>

      <div className="border-t p-3">
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand (Ctrl+B)" : "Collapse (Ctrl+B)"}
          className="flex h-8 w-full items-center justify-center rounded-md text-muted-foreground transition hover:bg-background hover:text-foreground"
        >
          {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
        </button>
      </div>
    </aside>
  );
}
