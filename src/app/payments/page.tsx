import { CreditCard, Plus, Search } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { PaymentRepository } from "@/domains/sales/repositories/payment-repository";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";

export const metadata: Metadata = { title: "Payments" };

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams;
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  const { data: payments } = await new PaymentRepository().listWithFilters(context.organizationId, {
    pageSize: 100,
  });

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex items-center justify-between border-b pb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-normal">Payments</h1>
            <p className="mt-2 text-sm text-muted-foreground">Record and view customer payments against invoices.</p>
          </div>
          <Link href="/payments/new" className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90">
            <Plus className="size-4" />Record Payment
          </Link>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <form className="relative flex-1 sm:max-w-xs" method="GET" action="/payments">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input className="h-10 w-full rounded-lg border bg-background pl-10 pr-4 text-sm outline-none focus:border-primary" name="q" placeholder="Search..." type="search" defaultValue={params.q ?? ""} />
          </form>
        </div>

        {payments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CreditCard className="size-10 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">No payments recorded yet.</p>
            <p className="mt-1 text-xs text-muted-foreground">Record payments against issued invoices.</p>
          </div>
        ) : (
          <div className="rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/70 text-xs font-semibold uppercase text-muted-foreground">
                <tr className="border-b">
                  <th className="h-10 px-4 text-left">Payment</th><th className="h-10 px-4 text-left">Invoice</th><th className="h-10 px-4 text-left">Customer</th>
                  <th className="h-10 px-4 text-left">Method</th><th className="h-10 px-4 text-right">Amount</th><th className="h-10 px-4 text-right">Date</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b last:border-b-0 hover:bg-muted/30">
                    <td className="h-12 px-4 font-medium">{p.paymentNumber}</td>
                    <td className="h-12 px-4">{p.invoice?.invoiceNumber ?? "-"}</td>
                    <td className="h-12 px-4">{p.customer?.name ?? "-"}</td>
                    <td className="h-12 px-4">{p.method.replace(/_/g, " ")}</td>
                    <td className="h-12 px-4 text-right font-mono tabular-nums">{Number(p.amount).toFixed(3)}</td>
                    <td className="h-12 px-4 text-right font-mono tabular-nums text-muted-foreground">{new Date(p.paidAt).toLocaleDateString()}</td>
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
