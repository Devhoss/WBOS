import { ArrowLeft, CreditCard, DollarSign, FileText, Plus, Receipt } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { CustomerRepository } from "@/domains/customers/repositories/customer-repository";
import { prisma } from "@/infrastructure/database/prisma";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";

export async function generateMetadata({ params }: { params: Promise<{ customerId: string }> }): Promise<Metadata> {
  const { customerId } = await params;
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  const customer = await new CustomerRepository().findById(context.organizationId, customerId);
  if (!customer) return { title: "Not Found" };
  return { title: customer.name };
}

export default async function CustomerDetailPage({ params }: { params: Promise<{ customerId: string }> }) {
  const { customerId } = await params;
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  const customer = await new CustomerRepository().findById(context.organizationId, customerId);
  if (!customer) notFound();

  const [invoices, payments] = await Promise.all([
    prisma.invoice.findMany({
      where: { organizationId: context.organizationId, customerId },
      include: { salesOrder: { select: { soNumber: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.payment.findMany({
      where: { organizationId: context.organizationId, customerId },
      include: { invoice: { select: { invoiceNumber: true } } },
      orderBy: { paidAt: "desc" },
    }),
  ]);

  const totalInvoiced = invoices.reduce((s, inv) => s + Number(inv.totalAmount), 0);
  const totalPaid = invoices.reduce((s, inv) => s + Number(inv.amountPaid), 0);
  const outstanding = totalInvoiced - totalPaid;

  const openInvoices = invoices.filter((inv) => ["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(inv.status));

  const statusBadge: Record<string, string> = {
    ISSUED: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    PAID: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    PARTIALLY_PAID: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
    OVERDUE: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
    CANCELLED: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
    CREDITED: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
    DRAFT: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="border-b pb-6">
          <Link href="/customers" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-3" />Back to Customers
          </Link>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-normal">{customer.name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {customer.code ? `${customer.code} · ` : ""}
                {customer.contactName ?? ""}
                {customer.email ? ` · ${customer.email}` : ""}
                {customer.phone ? ` · ${customer.phone}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link href={`/sales/orders/new?customerId=${customerId}`} className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition hover:bg-muted">
                <Plus className="size-4" />New Order
              </Link>
              <Link href={`/payments/new?customerId=${customerId}`} className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition hover:opacity-90">
                <CreditCard className="size-4" />Record Payment
              </Link>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          <div className="rounded-lg border p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Receipt className="size-4" />Total Invoiced
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{totalInvoiced.toFixed(3)}</p>
          </div>
          <div className="rounded-lg border p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <DollarSign className="size-4" />Total Paid
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-green-600">{totalPaid.toFixed(3)}</p>
          </div>
          <div className="rounded-lg border p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="size-4" />Open Invoices
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{openInvoices.length}</p>
          </div>
          <div className="rounded-lg border p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CreditCard className="size-4" />Outstanding Balance
            </div>
            <p className={`mt-2 text-2xl font-semibold tabular-nums ${outstanding > 0 ? "text-amber-600" : "text-green-600"}`}>
              {outstanding.toFixed(3)}
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-lg border p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Open Invoices</h2>
              <Link href={`/invoices?customerId=${customerId}`} className="text-xs text-primary hover:underline">View all</Link>
            </div>
            {openInvoices.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">No open invoices.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {openInvoices.map((inv) => (
                  <Link key={inv.id} href={`/invoices/${inv.id}`}
                    className="flex items-center justify-between rounded-md border p-3 text-sm transition hover:bg-muted/30">
                    <div>
                      <span className="font-medium">{inv.invoiceNumber}</span>
                      <span className={`ml-2 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge[inv.status] ?? ""}`}>
                        {inv.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    <span className="font-mono tabular-nums text-muted-foreground">
                      {(Number(inv.totalAmount) - Number(inv.amountPaid)).toFixed(3)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-lg border p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Payment History</h2>
              <Link href={`/payments?customerId=${customerId}`} className="text-xs text-primary hover:underline">View all</Link>
            </div>
            {payments.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">No payments recorded.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {payments.slice(0, 10).map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                    <div>
                      <span className="font-medium">{p.paymentNumber}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{p.invoice?.invoiceNumber ?? "-"}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{p.method.replace(/_/g, " ")}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono tabular-nums">{Number(p.amount).toFixed(3)}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{new Date(p.paidAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <section className="rounded-lg border p-5">
          <h2 className="text-sm font-semibold">Customer Details</h2>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
            {customer.address ? <div><dt className="text-muted-foreground">Address</dt><dd>{customer.address}</dd></div> : null}
            {customer.paymentTerms ? <div><dt className="text-muted-foreground">Payment Terms</dt><dd>{customer.paymentTerms}</dd></div> : null}
            {customer.creditLimit ? <div><dt className="text-muted-foreground">Credit Limit</dt><dd className="font-mono tabular-nums">{Number(customer.creditLimit).toFixed(3)}</dd></div> : null}
            {customer.notes ? <div><dt className="text-muted-foreground">Notes</dt><dd>{customer.notes}</dd></div> : null}
          </dl>
        </section>
      </div>
    </AppShell>
  );
}
