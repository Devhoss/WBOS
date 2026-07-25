import { ArrowLeft, Calendar, FileText, Hash, Info, Package, RotateCcw, User } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { ShipmentRepository } from "@/domains/sales/repositories/shipment-repository";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { prisma } from "@/infrastructure/database/prisma";

import { statusColorClass, formatStatus } from "@/components/status-colors";
import { ShipmentDeliverAction } from "../shipment-complete-action";
import { ShipmentStatusAction } from "../shipment-status-action";
import { getEntityTimeline } from "@/app/entity-timeline";
import { DocumentTimeline } from "@/app/document-timeline";
import { RelatedDocuments } from "@/components/related-documents";
import { PickingList } from "./picking-list";

export async function generateMetadata({ params }: { params: Promise<{ shipmentId: string }> }): Promise<Metadata> {
  const { shipmentId } = await params;
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  const shipment = await new ShipmentRepository().findById(context.organizationId, shipmentId);

  if (!shipment) {
    return { title: "Not Found" };
  }

  return { title: shipment.shipmentNumber };
}

export default async function ShipmentDetailPage({ params }: { params: Promise<{ shipmentId: string }> }) {
  const { shipmentId } = await params;
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  const shipment = await new ShipmentRepository().findById(context.organizationId, shipmentId);

  if (!shipment) notFound();

  const timeline = await getEntityTimeline(context.organizationId, "Shipment", shipment.id);

  const [relatedInvoices, relatedTasks] = await Promise.all([
    prisma.invoice.findMany({
      where: { salesOrderId: shipment.salesOrderId, organizationId: context.organizationId },
      select: { id: true, invoiceNumber: true, status: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.task.findMany({
      where: {
        organizationId: context.organizationId,
        referenceType: "SALES_ORDER",
        referenceId: shipment.salesOrderId,
      },
      select: { id: true, taskNumber: true, status: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const showPicking = ["PENDING_PICK", "PICKING", "PICKED"].includes(shipment.status);
  const canStatusAdvance = ["PICKED", "LOADED"].includes(shipment.status);
    const canDeliver = shipment.status === "LOADED";

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="border-b pb-6">
          <div className="flex items-start justify-between">
            <div>
              <Link href="/sales/shipments" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <ArrowLeft className="size-3" />Back to Shipments
              </Link>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-normal">{shipment.shipmentNumber}</h1>
                <span className={`inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-xs font-medium ${statusColorClass(shipment.status)}`}>
                  {formatStatus(shipment.status)}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Sales Order: {shipment.salesOrder.soNumber} &middot; {shipment.salesOrder.customer.name}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {showPicking ? (
              <PickingList
                lines={shipment.lines.map((l) => ({
                  ...l,
                  quantity: Number(l.quantity),
                  pickedQuantity: Number(l.pickedQuantity),
                }))}
                status={shipment.status}
              />
            ) : (
              <section className="rounded-lg border p-5">
                <h2 className="text-sm font-semibold">Line Items</h2>
                <div className="mt-3 overflow-x-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/70 text-xs font-semibold uppercase text-muted-foreground">
                      <tr className="border-b">
                        <th className="h-10 px-3 text-left">Product</th>
                        <th className="h-10 px-3 text-right">Quantity</th>
                        <th className="h-10 px-3 text-right">Picked</th>
                        <th className="h-10 px-3 text-left">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shipment.lines.map((line) => (
                        <tr key={line.id} className="border-b last:border-b-0 hover:bg-muted/30">
                          <td className="h-12 px-3">
                            <span className="font-medium">{line.productName}</span>
                            <span className="ml-2 font-mono text-xs text-muted-foreground">{line.productSku}</span>
                          </td>
                          <td className="h-12 px-3 text-right font-mono tabular-nums">{Number(line.quantity).toFixed(3)}</td>
                          <td className="h-12 px-3 text-right font-mono tabular-nums text-emerald-600">{Number(line.pickedQuantity).toFixed(3)}</td>
                          <td className="h-12 px-3 text-muted-foreground">{line.notes ?? "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>

          <div className="space-y-6">
            <section className="rounded-lg border p-5">
              <h2 className="text-sm font-semibold">Details</h2>
              <dl className="mt-3 space-y-3 text-sm">
                <div className="flex items-center gap-2"><Hash className="size-4 text-muted-foreground" /><dt className="text-muted-foreground">Number</dt><dd className="ml-auto font-medium">{shipment.shipmentNumber}</dd></div>
                <div className="flex items-center gap-2"><Info className="size-4 text-muted-foreground" /><dt className="text-muted-foreground">Status</dt><dd className="ml-auto">{formatStatus(shipment.status)}</dd></div>
                <div className="flex items-center gap-2"><Package className="size-4 text-muted-foreground" /><dt className="text-muted-foreground">Warehouse</dt><dd className="ml-auto">{shipment.warehouse?.name ?? "-"}</dd></div>
                <div className="flex items-center gap-2"><User className="size-4 text-muted-foreground" /><dt className="text-muted-foreground">Created by</dt><dd className="ml-auto">{shipment.createdBy?.name ?? "Unknown"}</dd></div>
                {shipment.notes ? <div className="flex items-start gap-2"><FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><dt className="text-muted-foreground">Office Instructions</dt><dd className="ml-auto max-w-[200px] text-right text-xs">{shipment.notes}</dd></div> : null}
                {shipment.warehouseNotes ? <div className="flex items-start gap-2"><FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><dt className="text-muted-foreground">Warehouse Notes</dt><dd className="ml-auto max-w-[200px] text-right text-xs">{shipment.warehouseNotes}</dd></div> : null}
                {shipment.pickedAt ? <div className="flex items-center gap-2"><Calendar className="size-4 text-muted-foreground" /><dt className="text-muted-foreground">Picked at</dt><dd className="ml-auto">{new Date(shipment.pickedAt).toLocaleString()}</dd></div> : null}
                {shipment.loadedAt ? <div className="flex items-center gap-2"><Calendar className="size-4 text-muted-foreground" /><dt className="text-muted-foreground">Loaded at</dt><dd className="ml-auto">{new Date(shipment.loadedAt).toLocaleString()}</dd></div> : null}
                {shipment.deliveredAt ? <div className="flex items-center gap-2"><Calendar className="size-4 text-muted-foreground" /><dt className="text-muted-foreground">Delivered at</dt><dd className="ml-auto">{new Date(shipment.deliveredAt).toLocaleString()}</dd></div> : null}
                {shipment.failedAt ? <div className="flex items-center gap-2"><Calendar className="size-4 text-muted-foreground" /><dt className="text-muted-foreground">Failed at</dt><dd className="ml-auto">{new Date(shipment.failedAt).toLocaleString()}<br /><span className="text-xs">{shipment.failureReason}</span></dd></div> : null}
              </dl>
            </section>

            <RelatedDocuments title="Related Documents" documents={[
              { href: `/sales/orders/${shipment.salesOrderId}`, label: shipment.salesOrder.soNumber, subtitle: shipment.salesOrder.customer.name },
              ...(relatedInvoices.length > 0 ? relatedInvoices.map((inv) => ({
                href: `/invoices/${inv.id}`,
                label: inv.invoiceNumber,
                status: inv.status,
              })) : []),
              ...(relatedTasks.length > 0 ? relatedTasks.map((t) => ({
                href: `/tasks/${t.id}`,
                label: t.taskNumber,
                status: t.status,
              })) : []),
            ]} />

            {shipment.status === "DELIVERED" ? (
              <section className="rounded-lg border p-5">
                <h2 className="text-sm font-semibold">Return</h2>
                <p className="mt-1 text-xs text-muted-foreground">Create a return for goods from this shipment.</p>
                <div className="mt-3">
                  <Link
                    href={`/returns/new?salesOrderId=${shipment.salesOrderId}`}
                    className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium transition hover:bg-muted"
                  >
                    <RotateCcw className="size-4" />
                    Create Return
                  </Link>
                </div>
              </section>
            ) : null}

            {canStatusAdvance || canDeliver ? (
              <section className="rounded-lg border p-5">
                <h2 className="text-sm font-semibold">Actions</h2>
                <div className="mt-3 space-y-2">
                  {canStatusAdvance ? <ShipmentStatusAction shipmentId={shipment.id} currentStatus={shipment.status} /> : null}
                  {canDeliver ? <ShipmentDeliverAction shipmentId={shipment.id} /> : null}
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
