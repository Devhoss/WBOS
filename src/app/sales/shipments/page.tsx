import { Package, Plus, Search } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { ShipmentRepository } from "@/domains/sales/repositories/shipment-repository";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";

import { statusColorClass, formatStatus } from "@/components/status-colors";

export const metadata: Metadata = { title: "Shipments" };

export default async function ShipmentsListPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const params = await searchParams;
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  const { data: shipments } = await new ShipmentRepository().listWithFilters(context.organizationId, {
    ...(params.status ? { status: params.status as "PENDING_PICK" | "PICKING" | "PICKED" | "LOADED" | "OUT_FOR_DELIVERY" | "DELIVERED" | "FAILED" } : {}),
    pageSize: 100,
  });

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex items-center justify-between border-b pb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-normal">Shipments</h1>
            <p className="mt-2 text-sm text-muted-foreground">Manage warehouse shipments and pickings.</p>
          </div>
          <Link href="/sales/shipments/new" className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90">
            <Plus className="size-4" />New Shipment
          </Link>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <form className="relative flex-1 sm:max-w-xs" method="GET" action="/sales/shipments">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input className="h-10 w-full rounded-lg border bg-background pl-10 pr-4 text-sm outline-none focus:border-primary" name="q" placeholder="Search by number or customer..." type="search" defaultValue={params.q ?? ""} />
          </form>
          <div className="flex gap-2">
            {["", "PENDING_PICK", "PICKING", "PICKED", "LOADED", "OUT_FOR_DELIVERY", "DELIVERED", "FAILED"].map((s) => (
              <Link key={s} href={s ? `/sales/shipments?status=${s}` : "/sales/shipments"}
                className={`inline-flex h-9 items-center rounded-md border px-3 text-xs font-medium transition hover:bg-muted ${params.status === s || (!params.status && !s) ? "bg-primary text-primary-foreground" : ""}`}>
                {s ? formatStatus(s) : "All"}
              </Link>
            ))}
          </div>
        </div>

        {shipments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Package className="size-10 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">No shipments found.</p>
            <p className="mt-1 text-xs text-muted-foreground">Create a new shipment to get started.</p>
          </div>
        ) : (
          <div className="rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/70 text-xs font-semibold uppercase text-muted-foreground">
                <tr className="border-b">
                  <th className="h-10 px-4 text-left">Shipment</th><th className="h-10 px-4 text-left">Sales Order</th><th className="h-10 px-4 text-left">Customer</th><th className="h-10 px-4 text-center">Lines</th><th className="h-10 px-4 text-center">Status</th><th className="h-10 px-4 text-right">Created</th><th className="h-10 px-4 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {shipments.map((s) => (
                  <tr key={s.id} className="border-b last:border-b-0 hover:bg-muted/30">
                    <td className="h-12 px-4 font-medium">{s.shipmentNumber}</td>
                    <td className="h-12 px-4">{s.salesOrder.soNumber}</td>
                    <td className="h-12 px-4">{s.salesOrder.customer.name}</td>
                    <td className="h-12 px-4 text-center font-mono tabular-nums text-muted-foreground">{s._count.lines}</td>
                    <td className="h-12 px-4 text-center">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColorClass(s.status)}`}>{formatStatus(s.status)}</span>
                    </td>
                    <td className="h-12 px-4 text-right font-mono tabular-nums text-muted-foreground">{new Date(s.createdAt).toLocaleDateString()}</td>
                    <td className="h-12 px-4 text-right">
                      <Link href={`/sales/shipments/${s.id}`} className="inline-flex h-8 items-center rounded-md px-2.5 text-xs font-medium transition hover:bg-muted">View</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
