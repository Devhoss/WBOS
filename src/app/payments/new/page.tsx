import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { InvoiceRepository } from "@/domains/sales/repositories/invoice-repository";
import { CustomerBalanceService } from "@/domains/sales/services/customer-balance-service";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";

import { RecordPaymentForm } from "../record-payment-form";

export const metadata: Metadata = { title: "Record Payment" };

export default async function NewPaymentPage({ searchParams }: { searchParams: Promise<{ invoiceId?: string }> }) {
  const params = await searchParams;
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  const { data: invoices } = await new InvoiceRepository().listWithFilters(context.organizationId, {
    status: "ISSUED", pageSize: 100,
  });
  const { data: partialInvoices } = await new InvoiceRepository().listWithFilters(context.organizationId, {
    status: "PARTIALLY_PAID", pageSize: 100,
  });

  const payableInvoices = [...invoices, ...partialInvoices];

  const balanceService = new CustomerBalanceService();
  const balancePromises = payableInvoices.map((inv) =>
    balanceService.getBalanceSummary(context.organizationId, inv.customer.id).then((b) => ({
      customerId: inv.customer.id,
      ...b,
    })),
  );
  const balances = await Promise.all(balancePromises);
  const balanceMap = new Map(balances.map((b) => [b.customerId, b]));

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="border-b pb-6">
          <Link href="/payments" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-3" />Back to Payments
          </Link>
          <h1 className="text-2xl font-semibold tracking-normal">Record Payment</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Record a payment received from a customer against an invoice.</p>
        </div>

        <RecordPaymentForm
          invoices={payableInvoices.map((inv) => ({
            id: inv.id, invoiceNumber: inv.invoiceNumber, customerName: inv.customer.name,
            totalAmount: Number(inv.totalAmount), amountPaid: Number(inv.amountPaid),
            currency: inv.currency, customerId: inv.customer.id,
            customerOutstanding: balanceMap.get(inv.customer.id)?.outstanding ?? 0,
          }))}
          preselectedInvoiceId={params.invoiceId}
        />
      </div>
    </AppShell>
  );
}
