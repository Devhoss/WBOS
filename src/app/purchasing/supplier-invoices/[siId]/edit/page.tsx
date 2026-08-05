import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { SupplierInvoiceRepository } from "@/domains/supplier-invoices/repositories/supplier-invoice-repository";
import { SupplierRepository } from "@/domains/suppliers/repositories/supplier-repository";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";

import { SupplierInvoiceForm } from "../../supplier-invoice-form";

export const metadata: Metadata = { title: "Edit Supplier Invoice" };

export default async function EditSupplierInvoicePage({
  params,
}: {
  params: Promise<{ siId: string }>;
}) {
  const { siId } = await params;
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  const [invoice, suppliers] = await Promise.all([
    new SupplierInvoiceRepository().findById(context.organizationId, siId),
    new SupplierRepository().listActive(context.organizationId),
  ]);

  if (!invoice) {
    notFound();
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="border-b pb-6">
          <Link href={`/purchasing/supplier-invoices/${siId}`} className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-3" />
            Back to {invoice.siNumber}
          </Link>
          <h1 className="text-2xl font-semibold tracking-normal">Edit {invoice.siNumber}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Only draft supplier invoices can be edited. Issue the invoice to lock it in.
          </p>
        </div>

        <SupplierInvoiceForm
          suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
          invoice={{
            id: invoice.id,
            supplierId: invoice.supplierId,
            currency: invoice.currency,
            subtotal: String(Number(invoice.subtotal)),
            taxAmount: String(Number(invoice.taxAmount)),
            totalAmount: String(Number(invoice.totalAmount)),
            reference: invoice.reference ?? "",
            dueDate: invoice.dueDate ? new Date(invoice.dueDate).toISOString().split("T")[0] : "",
            notes: invoice.notes ?? "",
          }}
        />
      </div>
    </AppShell>
  );
}