import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { SupplierRepository } from "@/domains/suppliers/repositories/supplier-repository";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";

import { ImportShipmentForm } from "../import-shipment-form";

export const metadata: Metadata = { title: "New Import Shipment" };

export default async function NewImportShipmentPage() {
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  const suppliers = await new SupplierRepository().listActive(context.organizationId);

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="border-b pb-6">
          <h1 className="text-2xl font-semibold tracking-normal">New Import Shipment</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Create an import shipment for an overseas supplier, then link it to a purchase order, supplier invoice, and
            landed cost as the import progresses.
          </p>
        </div>

        <ImportShipmentForm suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))} />
      </div>
    </AppShell>
  );
}