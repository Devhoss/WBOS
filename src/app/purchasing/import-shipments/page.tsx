import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { ImportShipmentRepository } from "@/domains/import-shipments/repositories/import-shipment-repository";
import { computeShipmentState } from "@/domains/import-shipments/stage/compute-shipment-state";
import { SupplierRepository } from "@/domains/suppliers/repositories/supplier-repository";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";

import { ImportShipmentTable } from "./import-shipment-table";

export const metadata: Metadata = { title: "Import Shipments" };

export default async function ImportShipmentsListPage() {
  const context = await new AuthenticatedRequestContextService().getCurrentContext();

  const [result, suppliers] = await Promise.all([
    new ImportShipmentRepository().listWithFilters(context.organizationId, { page: 1, pageSize: 100 }),
    new SupplierRepository().listActive(context.organizationId),
  ]);

  const rows = result.data.map((shipment) => ({
    id: shipment.id,
    shipmentNumber: shipment.shipmentNumber,
    supplierName: shipment.supplier.name,
    containerRef: shipment.containerRef ?? "",
    eta: shipment.eta?.toISOString() ?? null,
    createdAt: shipment.createdAt.toISOString(),
    state: computeShipmentState({
      supplierInvoice: shipment.supplierInvoice
        ? { status: shipment.supplierInvoice.status, payments: shipment.supplierInvoice.payments }
        : null,
      landedCost: shipment.landedCost ? { status: shipment.landedCost.status } : null,
      purchaseOrders: shipment.purchaseOrderLinks.map((l) => ({ status: l.purchaseOrder.status })),
    }),
  }));

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="border-b pb-6">
          <h1 className="text-2xl font-semibold tracking-normal">Import Shipments</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Manage an import from start to finish: linked purchase order, supplier invoice, documents, receiving, and
            landed costs — all on one screen.
          </p>
        </div>

        <ImportShipmentTable
          shipments={rows}
          suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
          total={result.total}
        />
      </div>
    </AppShell>
  );
}