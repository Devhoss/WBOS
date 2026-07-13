"use client";

import {
  BadgePercent, BarChart3, Boxes, ClipboardList, CreditCard,
  Home, Package, ReceiptText, Settings, ShoppingCart, Tags, Truck, Users, Warehouse,
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
  { name: "Customers", href: "/customers", icon: Users },
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
    return pathname.startsWith(href);
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
