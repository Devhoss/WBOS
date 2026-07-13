"use client";

import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { NavItems } from "./nav-items";
import { OrgBranding } from "./org-branding";
import { useSidebar } from "./sidebar-context";

export function MobileNav({
  organizationName,
  logoPath,
}: {
  organizationName: string;
  logoPath?: string | null;
}) {
  const { mobileOpen, openMobile, closeMobile } = useSidebar();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const drawer = (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r bg-background shadow-xl transition-transform duration-200 ease-in-out will-change-transform lg:hidden ${
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      }`}
      style={{ height: "100dvh" }}
    >
      <div className="flex h-16 shrink-0 items-center justify-between border-b px-4">
        <div className="flex items-center gap-3 overflow-hidden">
          <OrgBranding
            name={organizationName}
            logoPath={logoPath}
            size="sm"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {organizationName}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              Wholesale Operations
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={closeMobile}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Close navigation menu"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <NavItems collapsed={false} />
      </div>
    </aside>
  );

  const backdrop = mobileOpen ? (
    <div
      className="fixed inset-0 z-40 bg-black/50 lg:hidden"
      onClick={closeMobile}
      aria-hidden="true"
    />
  ) : null;

  return (
    <>
      <button
        type="button"
        onClick={openMobile}
        className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
        aria-label="Open navigation menu"
      >
        <Menu className="size-5" />
      </button>

      {mounted && createPortal(backdrop, document.body)}
      {mounted && createPortal(drawer, document.body)}
    </>
  );
}
