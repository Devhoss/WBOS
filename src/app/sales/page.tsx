import { ClipboardList, FileText, PackagePlus, Truck, Wallet } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = { title: "Sales" };

const sections = [
  {
    title: "Orders",
    description: "Create and manage sales orders. Submit, approve, and track fulfillment.",
    href: "/sales/orders",
    icon: ClipboardList,
  },
  {
    title: "New Order",
    description: "Create a new sales order with customer, line items, and pricing.",
    href: "/sales/orders/new",
    icon: PackagePlus,
  },
  {
    title: "Shipments",
    description: "Manage warehouse picking and shipping. Complete shipments post to inventory.",
    href: "/sales/shipments",
    icon: Truck,
  },
  {
    title: "Invoices",
    description: "Generate and manage invoices. Track payments and outstanding balances.",
    href: "/invoices",
    icon: FileText,
  },
  {
    title: "Payments",
    description: "Record customer payments against invoices.",
    href: "/payments",
    icon: Wallet,
  },
];

export default function SalesOverviewPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="border-b pb-6">
          <h1 className="text-2xl font-semibold tracking-normal">Sales & Fulfillment</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Manage the complete sales lifecycle: create orders, pick and ship products, generate invoices, and record
            payments. Inventory is only reduced when a shipment is completed.
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
