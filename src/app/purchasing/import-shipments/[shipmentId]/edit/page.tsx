import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { ImportShipmentRepository } from "@/domains/import-shipments/repositories/import-shipment-repository";
import { SupplierRepository } from "@/domains/suppliers/repositories/supplier-repository";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";

import { ImportShipmentForm } from "../../import-shipment-form";

export async function generateMetadata({ params }: { params: Promise<{ shipmentId: string }> }): Promise<Metadata> {
  const { shipmentId } = await params;
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  const shipment = await new ImportShipmentRepository().findById(context.organizationId, shipmentId);

  if (!shipment) return { title: "Not Found" };
  return { title: `Edit ${shipment.shipmentNumber}` };
}

export default async function EditImportShipmentPage({
  params,
}: {
  params: Promise<{ shipmentId: string }>;
}) {
  const { shipmentId } = await params;
  const context = await new AuthenticatedRequestContextService().getCurrentContext();

  const [shipment, suppliers] = await Promise.all([
    new ImportShipmentRepository().findById(context.organizationId, shipmentId),
    new SupplierRepository().listActive(context.organizationId),
  ]);

  if (!shipment) {
    notFound();
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="border-b pb-6">
          <h1 className="text-2xl font-semibold tracking-normal">Edit {shipment.shipmentNumber}</h1>
        </div>

        <ImportShipmentForm
          suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
          shipment={{
            id: shipment.id,
            supplierId: shipment.supplierId,
            currency: shipment.currency,
            containerRef: shipment.containerRef ?? "",
            vessel: shipment.vessel ?? "",
            portOfLoading: shipment.portOfLoading ?? "",
            portOfDischarge: shipment.portOfDischarge ?? "",
            etd: shipment.etd ? shipment.etd.toISOString().slice(0, 10) : "",
            eta: shipment.eta ? shipment.eta.toISOString().slice(0, 10) : "",
            notes: shipment.notes ?? "",
          }}
        />
      </div>
    </AppShell>
  );
}