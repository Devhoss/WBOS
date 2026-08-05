import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { SupplierRepository } from "@/domains/suppliers/repositories/supplier-repository";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";

import { SupplierInvoiceForm } from "../supplier-invoice-form";

export const metadata: Metadata = { title: "New Supplier Invoice" };

export default async function NewSupplierInvoicePage() {
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  const suppliers = await new SupplierRepository().listActive(context.organizationId);

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="border-b pb-6">
          <Link href="/purchasing/supplier-invoices" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-3" />
            Back to Supplier Invoices
          </Link>
          <h1 className="text-2xl font-semibold tracking-normal">Create Supplier Invoice</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Record a supplier invoice for imported goods. Issue it, then record payments against it.
          </p>
        </div>

        <SupplierInvoiceForm suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))} />
      </div>
    </AppShell>
  );
}