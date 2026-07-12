import { FileText, Search } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { InvoiceRepository } from "@/domains/sales/repositories/invoice-repository";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";

import { statusColorClass, formatStatus } from "@/components/status-colors";

export const metadata: Metadata = { title: "Invoices" };

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const params = await searchParams;
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  const { data: invoices } = await new InvoiceRepository().listWithFilters(context.organizationId, {
    search: params.q, pageSize: 100,
    ...(params.status ? { status: params.status as "ISSUED" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "CANCELLED" | "DRAFT" } : {}),
  });

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="border-b pb-6">
          <h1 className="text-2xl font-semibold tracking-normal">Invoices</h1>
          <p className="mt-2 text-sm text-muted-foreground">View and manage sales invoices.</p>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <form className="relative flex-1 sm:max-w-xs" method="GET" action="/invoices">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input className="h-10 w-full rounded-lg border bg-background pl-10 pr-4 text-sm outline-none focus:border-primary" name="q" placeholder="Search by number or customer..." type="search" defaultValue={params.q ?? ""} />
          </form>
          <div className="flex flex-wrap gap-2">
            {["", "ISSUED", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED"].map((s) => (
              <Link key={s} href={s ? `/invoices?status=${s}` : "/invoices"}
                className={`inline-flex h-9 items-center rounded-md border px-3 text-xs font-medium transition hover:bg-muted ${params.status === s || (!params.status && !s) ? "bg-primary text-primary-foreground" : ""}`}>
                {s ? formatStatus(s) : "All"}
              </Link>
            ))}
          </div>
        </div>

        {invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="size-10 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">No invoices found.</p>
            <p className="mt-1 text-xs text-muted-foreground">Invoices are generated from completed sales orders.</p>
          </div>
        ) : (
          <div className="rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/70 text-xs font-semibold uppercase text-muted-foreground">
                <tr className="border-b">
                  <th className="h-10 px-4 text-left">Invoice</th><th className="h-10 px-4 text-left">Sales Order</th><th className="h-10 px-4 text-left">Customer</th>
                  <th className="h-10 px-4 text-right">Total</th><th className="h-10 px-4 text-right">Paid</th><th className="h-10 px-4 text-center">Status</th><th className="h-10 px-4 text-right">Date</th><th className="h-10 px-4 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const total = Number(inv.totalAmount);
                  const paid = Number(inv.amountPaid);
                  return (
                    <tr key={inv.id} className="border-b last:border-b-0 hover:bg-muted/30">
                      <td className="h-12 px-4 font-medium">{inv.invoiceNumber}</td>
                      <td className="h-12 px-4">{inv.salesOrder?.soNumber ?? "-"}</td>
                      <td className="h-12 px-4">{inv.customer.name}</td>
                      <td className="h-12 px-4 text-right font-mono tabular-nums">{total.toFixed(3)}</td>
                      <td className="h-12 px-4 text-right font-mono tabular-nums text-muted-foreground">{paid.toFixed(3)}</td>
                      <td className="h-12 px-4 text-center">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColorClass(inv.status)}`}>{formatStatus(inv.status)}</span>
                      </td>
                      <td className="h-12 px-4 text-right font-mono tabular-nums text-muted-foreground">{inv.issuedAt ? new Date(inv.issuedAt).toLocaleDateString() : "-"}</td>
                      <td className="h-12 px-4 text-right">
                        <Link href={`/invoices/${inv.id}`} className="inline-flex h-8 items-center rounded-md px-2.5 text-xs font-medium transition hover:bg-muted">View</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
