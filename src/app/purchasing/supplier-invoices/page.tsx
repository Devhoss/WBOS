import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { SupplierInvoiceRepository } from "@/domains/supplier-invoices/repositories/supplier-invoice-repository";
import { SupplierRepository } from "@/domains/suppliers/repositories/supplier-repository";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";

import { SupplierInvoiceTable } from "./supplier-invoice-table";

export const metadata: Metadata = { title: "Supplier Invoices" };

export default async function SupplierInvoicesPage() {
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  const [result, suppliers] = await Promise.all([
    new SupplierInvoiceRepository().listWithFilters(context.organizationId, { pageSize: 50 }),
    new SupplierRepository().listActive(context.organizationId),
  ]);

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="border-b pb-6">
          <h1 className="text-2xl font-semibold tracking-normal">Supplier Invoices</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Record and pay supplier invoices for imported goods. Payments are tracked per invoice.
          </p>
        </div>

        <SupplierInvoiceTable
          invoices={result.data.map((inv) => ({
            id: inv.id,
            siNumber: inv.siNumber,
            status: inv.status,
            supplierName: inv.supplier.name,
            reference: inv.reference ?? "",
            totalAmount: Number(inv.totalAmount).toFixed(3),
            amountPaid: Number(inv.amountPaid).toFixed(3),
            currency: inv.currency,
            dueDate: inv.dueDate?.toISOString() ?? null,
            createdAt: inv.createdAt.toISOString(),
          }))}
          suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
          total={result.total}
        />
      </div>
    </AppShell>
  );
}