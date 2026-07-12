import { ClipboardList, PackagePlus, Truck, Warehouse } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = { title: "Purchasing" };

const sections = [
  {
    title: "Orders",
    description: "Create and manage purchase orders. Submit, approve, and track receipts.",
    href: "/purchasing/orders",
    icon: ClipboardList,
  },
  {
    title: "New Order",
    description: "Create a new purchase order with supplier, items, and delivery details.",
    href: "/purchasing/orders/new",
    icon: PackagePlus,
  },
  {
    title: "Receiving",
    description: "Receive goods against purchase orders. Partial and full receipts supported.",
    href: "/purchasing/receiving",
    icon: Warehouse,
  },
  {
    title: "Suppliers",
    description: "Manage supplier records, payment terms, and lead times.",
    href: "/suppliers",
    icon: Truck,
  },
];

export default function PurchasingOverviewPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="border-b pb-6">
          <h1 className="text-2xl font-semibold tracking-normal">Purchasing</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Purchase orders drive the procurement workflow. Create orders, manage approvals, and receive goods into
            inventory. Every receipt posts to the immutable inventory ledger.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
          {sections.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="group rounded-lg border p-5 transition hover:border-primary hover:shadow-sm"
            >
              <div className="flex items-start gap-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted group-hover:bg-primary/10">
                  <section.icon className="size-5 text-muted-foreground group-hover:text-primary" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold group-hover:text-primary">{section.title}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">{section.description}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
