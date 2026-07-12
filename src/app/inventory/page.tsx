import { ClipboardList, MinusCircle, PlusCircle, ScanBarcode, TableProperties, TrendingUp, Warehouse } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = { title: "Inventory" };

const sections = [
  {
    title: "Manual Receiving",
    description: "Add stock into a warehouse. Generates a Goods Receipt Note (GRN).",
    href: "/inventory/receiving",
    icon: PlusCircle,
  },
  {
    title: "Adjustments",
    description: "Correct inventory discrepancies with a documented reason.",
    href: "/inventory/adjustments",
    icon: MinusCircle,
  },
  {
    title: "Transfers",
    description: "Move stock between warehouses as single business documents.",
    href: "/inventory/transfers",
    icon: Warehouse,
  },
  {
    title: "Stock by Product",
    description: "View total stock quantities across all warehouses.",
    href: "/inventory/stock",
    icon: TableProperties,
  },
  {
    title: "Movement History",
    description: "View all inventory transactions and ledger activity.",
    href: "/inventory/movements",
    icon: ClipboardList,
  },
  {
    title: "Cycle Counts",
    description: "Reconcile physical stock against system quantities with documented counts.",
    href: "/inventory/cycle-counts",
    icon: ScanBarcode,
  },
  {
    title: "Stock by Warehouse",
    description: "View stock levels grouped by warehouse.",
    href: "/inventory/stock",
    icon: TrendingUp,
  },
];

export default function InventoryOverviewPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="border-b pb-6">
          <h1 className="text-2xl font-semibold tracking-normal">Inventory</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Inventory is driven by immutable ledger transactions. Every stock movement creates a permanent record.
            Current stock is always derived from the transaction history.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
