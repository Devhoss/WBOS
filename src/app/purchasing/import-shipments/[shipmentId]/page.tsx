import { Anchor, CheckCircle, CircleDashed } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { getEntityTimeline } from "@/app/entity-timeline";
import { DocumentTimeline } from "@/app/document-timeline";
import { TermLabel } from "@/components/help-tooltip";
import { AttachmentService } from "@/domains/attachments/services/attachment-service";
import { ImportShipmentRepository } from "@/domains/import-shipments/repositories/import-shipment-repository";
import { computeShipmentState, stageLabel } from "@/domains/import-shipments/stage/compute-shipment-state";
import { PurchaseOrderRepository } from "@/domains/purchasing/repositories/purchase-order-repository";
import { LandedCostService } from "@/domains/purchasing/services/landed-cost-service";
import { SupplierInvoiceRepository } from "@/domains/supplier-invoices/repositories/supplier-invoice-repository";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";

import { AttachmentTypeSection } from "../attachment-type-section";
import { ImportShipmentActions } from "../import-shipment-actions";
import { ImportShipmentLinks } from "../import-shipment-links";
import { StageStepper } from "../stage-stepper";

export async function generateMetadata({ params }: { params: Promise<{ shipmentId: string }> }): Promise<Metadata> {
  const { shipmentId } = await params;
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  const shipment = await new ImportShipmentRepository().findById(context.organizationId, shipmentId);

  if (!shipment) return { title: "Not Found" };
  return { title: shipment.shipmentNumber };
}

export default async function ImportShipmentDetailPage({
  params,
}: {
  params: Promise<{ shipmentId: string }>;
}) {
  const { shipmentId } = await params;
  const context = await new AuthenticatedRequestContextService().getCurrentContext();

  const [shipment, attachments] = await Promise.all([
    new ImportShipmentRepository().findById(context.organizationId, shipmentId),
    new AttachmentService().list(context, "ImportShipment", shipmentId),
  ]);

  if (!shipment) {
    notFound();
  }

  const linkedPoIds = shipment.purchaseOrderLinks.map((l) => l.purchaseOrderId);

  const [poResult, siResult, lcResult, timeline] = await Promise.all([
    new PurchaseOrderRepository().listWithFilters(context.organizationId, { page: 1, pageSize: 100 }),
    new SupplierInvoiceRepository().listWithFilters(context.organizationId, { page: 1, pageSize: 100 }),
    new LandedCostService().list(context, { take: 100 }),
    getEntityTimeline(context.organizationId, "ImportShipment", shipment.id),
  ]);

  const linkablePoIds = ["APPROVED", "PARTIALLY_RECEIVED", "FULLY_RECEIVED"];
  const purchaseOrderOptions = poResult.data
    .filter((po) => !linkedPoIds.includes(po.id) && linkablePoIds.includes(po.status))
    .map((po) => ({ id: po.id, label: `${po.poNumber} · ${po.supplier.name} · ${po.status}` }));

  const linkableSiIds = ["ISSUED", "PARTIALLY_PAID"];
  const supplierInvoiceOptions = siResult.data
    .filter((si) => si.id !== shipment.supplierInvoiceId && linkableSiIds.includes(si.status))
    .map((si) => ({ id: si.id, label: `${si.siNumber} · ${si.supplier.name} · ${si.status}` }));

  const landedCostOptions = lcResult.items
    .filter((lc) => lc.id !== shipment.landedCostId && lc.status !== "CANCELLED")
    .map((lc) => ({ id: lc.id, label: `${lc.lcNumber} · ${lc.supplier?.name ?? "No supplier"} · ${lc.status}` }));

  const state = computeShipmentState({
    supplierInvoice: shipment.supplierInvoice
      ? { status: shipment.supplierInvoice.status, payments: shipment.supplierInvoice.payments }
      : null,
    landedCost: shipment.landedCost ? { status: shipment.landedCost.status } : null,
    purchaseOrders: shipment.purchaseOrderLinks.map((l) => ({ status: l.purchaseOrder.status })),
    attachments,
  });

  const linkedSupplierInvoice = shipment.supplierInvoice
    ? {
        id: shipment.supplierInvoice.id,
        siNumber: shipment.supplierInvoice.siNumber,
        status: shipment.supplierInvoice.status,
        supplierName: shipment.supplierInvoice.supplier.name,
        totalAmount: shipment.supplierInvoice.totalAmount.toString(),
        amountPaid: shipment.supplierInvoice.amountPaid.toString(),
      }
    : null;

  const linkedLandedCost = shipment.landedCost
    ? {
        id: shipment.landedCost.id,
        lcNumber: shipment.landedCost.lcNumber,
        status: shipment.landedCost.status,
        supplierName: shipment.supplier.name,
      }
    : null;

  const milestoneRows = [
    { label: "Deposit Paid", done: state.milestones.depositPaid, term: null as null },
    { label: "Final Payment", done: state.milestones.finalPaid, term: null as null },
    { label: "Goods Received", done: state.milestones.goodsReceived, term: "goodsReceipt" as const },
    { label: "Landed Cost Posted", done: state.milestones.landedCostPosted, term: "landedCost" as const },
  ];

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="border-b pb-6">
          <div className="flex items-start justify-between">
            <div>
              <Link
                href="/purchasing/import-shipments"
                className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <Anchor className="size-3" />
                Back to Import Shipments
              </Link>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-normal">{shipment.shipmentNumber}</h1>
                <span className={`inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-xs font-medium ${
                  state.stage === "COMPLETED"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                    : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                }`}>
                  {state.stage === "COMPLETED" ? <CheckCircle className="size-4" /> : <CircleDashed className="size-4" />}
                  {stageLabel(state.stage)}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {shipment.supplier.name}
                {shipment.containerRef ? <span className="ml-2 font-mono text-xs">· {shipment.containerRef}</span> : null}
              </p>
            </div>
          </div>
        </div>

        <section className="rounded-lg border p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Import Progress</h2>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">{state.progress}%</span>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${state.progress}%` }} />
          </div>
          <div className="mt-4">
            <StageStepper state={state} />
          </div>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {milestoneRows.map((m) => (
              <li key={m.label} className="flex items-center gap-2 text-sm">
                <span className={`inline-flex size-5 items-center justify-center rounded-full text-xs ${
                  m.done ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-muted text-muted-foreground"
                }`}>
                  {m.done ? "✓" : "•"}
                </span>
                <span className={m.done ? "font-medium" : "text-muted-foreground"}>
                  {m.term ? (
                    <TermLabel term={m.term}>{m.label}</TermLabel>
                  ) : (
                    m.label
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <ImportShipmentLinks
              shipmentId={shipment.id}
              purchaseOrderLinks={shipment.purchaseOrderLinks.map((l) => ({
                id: l.purchaseOrder.id,
                poNumber: l.purchaseOrder.poNumber,
                status: l.purchaseOrder.status,
                supplierName: shipment.supplier.name,
                totalAmount: l.purchaseOrder.totalAmount.toString(),
              }))}
              supplierInvoice={linkedSupplierInvoice}
              landedCost={linkedLandedCost}
              purchaseOrderOptions={purchaseOrderOptions}
              supplierInvoiceOptions={supplierInvoiceOptions}
              landedCostOptions={landedCostOptions}
            />

            <AttachmentTypeSection
              entityType="ImportShipment"
              entityId={shipment.id}
              attachments={attachments.map((att) => ({
                id: att.id,
                fileName: att.fileName,
                mimeType: att.mimeType,
                sizeBytes: att.sizeBytes,
                url: att.url,
                uploadedByName: att.uploadedBy?.name ?? null,
                createdAt: att.createdAt.toISOString(),
                attachmentType: att.attachmentType,
              }))}
            />
          </div>

          <div className="space-y-6">
            <section className="rounded-lg border p-5">
              <h2 className="text-sm font-semibold">Details</h2>
              <dl className="mt-3 space-y-3 text-sm">
                <div><dt className="text-xs text-muted-foreground">Supplier</dt><dd className="font-medium">{shipment.supplier.name}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Currency</dt><dd>{shipment.currency}</dd></div>
                {shipment.vessel ? <div><dt className="text-xs text-muted-foreground">Vessel</dt><dd>{shipment.vessel}</dd></div> : null}
                {shipment.portOfLoading ? <div><dt className="text-xs text-muted-foreground">Port of Loading</dt><dd>{shipment.portOfLoading}</dd></div> : null}
                {shipment.portOfDischarge ? <div><dt className="text-xs text-muted-foreground">Port of Discharge</dt><dd>{shipment.portOfDischarge}</dd></div> : null}
                {shipment.etd ? <div><dt className="text-xs text-muted-foreground">ETD</dt><dd>{new Date(shipment.etd).toLocaleDateString()}</dd></div> : null}
                {shipment.eta ? <div><dt className="text-xs text-muted-foreground">ETA</dt><dd>{new Date(shipment.eta).toLocaleDateString()}</dd></div> : null}
                <div><dt className="text-xs text-muted-foreground">Created by</dt><dd>{shipment.createdBy?.name ?? shipment.createdBy?.email ?? "Unknown"}</dd></div>
                {shipment.notes ? <div><dt className="text-xs text-muted-foreground">Notes</dt><dd className="mt-1 text-xs">{shipment.notes}</dd></div> : null}
              </dl>
            </section>

            {!shipment.archivedAt ? (
              <section className="rounded-lg border p-5">
                <h2 className="text-sm font-semibold">Actions</h2>
                <div className="mt-3 space-y-2">
                  <ImportShipmentActions shipmentId={shipment.id} archivedAt={null} />
                </div>
              </section>
            ) : null}

            <DocumentTimeline entries={timeline} />
          </div>
        </div>
      </div>
    </AppShell>
  );
}