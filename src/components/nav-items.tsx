"use client";

import {
  BadgePercent, BarChart3, Boxes, ClipboardList, CreditCard, FileText,
  Home, ListChecks, Package, ReceiptText, RotateCcw, Settings, ShoppingCart, Ship, Tags, Truck, Users, Warehouse,
} from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";

const navigation = [
  { name: "Dashboard", href: "/", icon: Home },
  { name: "Products", href: "/products", icon: Package },
  { name: "Categories", href: "/categories", icon: Tags },
  { name: "Inventory", href: "/inventory", icon: Boxes },
  { name: "Purchasing", href: "/purchasing", icon: ShoppingCart },
  { name: "Suppliers", href: "/suppliers", icon: Truck },
  { name: "Supplier Invoices", href: "/purchasing/supplier-invoices", icon: ReceiptText },
  { name: "Import Shipments", href: "/purchasing/import-shipments", icon: Ship },
  { name: "Customers", href: "/customers", icon: Users },
  { name: "Tasks", href: "/tasks", icon: ListChecks },
  { name: "Quotations", href: "/quotations", icon: FileText },
  { name: "Returns", href: "/returns", icon: RotateCcw },
  { name: "Credit Notes", href: "/credit-notes", icon: ReceiptText },
  { name: "Sales", href: "/sales", icon: BadgePercent },
  { name: "Units", href: "/units", icon: ClipboardList },
  { name: "Invoices", href: "/invoices", icon: ReceiptText },
  { name: "Payments", href: "/payments", icon: CreditCard },
  { name: "Warehouses", href: "/warehouses", icon: Warehouse },
  { name: "Reports", href: "/reports", icon: BarChart3 },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function NavItems({ collapsed }: { collapsed?: boolean }) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    const matches = navigation
      .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
      .map((item) => item.href);
    if (matches.length === 0) return false;
    const mostSpecific = matches.reduce((a, b) => (b.length > a.length ? b : a));
    return mostSpecific === href;
  }

  return (
    <>
      {navigation.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            title={collapsed ? item.name : undefined}
            className={`nav-item flex h-9 items-center gap-3 rounded-md text-sm transition ${
              active
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:bg-background hover:text-foreground"
            }`}
          >
            <item.icon className="size-4 shrink-0" />
            <span className="nav-item-label">{item.name}</span>
          </Link>
        );
      })}
    </>
  );
}
