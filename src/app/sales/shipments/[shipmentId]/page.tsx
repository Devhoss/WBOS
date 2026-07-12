import { ArrowLeft, Calendar, Hash, Info, Package, User } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { ShipmentRepository } from "@/domains/sales/repositories/shipment-repository";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";

import { statusColorClass, formatStatus } from "@/components/status-colors";
import { ShipmentDeliverAction } from "../shipment-complete-action";
import { ShipmentStatusAction } from "../shipment-status-action";
import { getEntityTimeline } from "@/app/entity-timeline";
import { DocumentTimeline } from "@/app/document-timeline";
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

  const showPicking = ["PENDING_PICK", "PICKING", "PICKED"].includes(shipment.status);
  const canStatusAdvance = ["PICKED", "LOADED"].includes(shipment.status);
  const canDeliver = shipment.status === "OUT_FOR_DELIVERY";

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
              <PickingList lines={shipment.lines as never[]} shipmentId={shipment.id} status={shipment.status} />
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
                {shipment.pickedAt ? <div className="flex items-center gap-2"><Calendar className="size-4 text-muted-foreground" /><dt className="text-muted-foreground">Picked at</dt><dd className="ml-auto">{new Date(shipment.pickedAt).toLocaleString()}</dd></div> : null}
                {shipment.loadedAt ? <div className="flex items-center gap-2"><Calendar className="size-4 text-muted-foreground" /><dt className="text-muted-foreground">Loaded at</dt><dd className="ml-auto">{new Date(shipment.loadedAt).toLocaleString()}</dd></div> : null}
                {shipment.deliveredAt ? <div className="flex items-center gap-2"><Calendar className="size-4 text-muted-foreground" /><dt className="text-muted-foreground">Delivered at</dt><dd className="ml-auto">{new Date(shipment.deliveredAt).toLocaleString()}</dd></div> : null}
                {shipment.failedAt ? <div className="flex items-center gap-2"><Calendar className="size-4 text-muted-foreground" /><dt className="text-muted-foreground">Failed at</dt><dd className="ml-auto">{new Date(shipment.failedAt).toLocaleString()}<br /><span className="text-xs">{shipment.failureReason}</span></dd></div> : null}
              </dl>
            </section>

            <section className="rounded-lg border p-5">
              <h2 className="text-sm font-semibold">Linked Order</h2>
              <Link href={`/sales/orders/${shipment.salesOrderId}`} className="mt-3 block rounded-md border p-3 text-sm transition hover:bg-muted/30">
                <div className="font-medium">{shipment.salesOrder.soNumber}</div>
                <div className="mt-1 text-xs text-muted-foreground">{shipment.salesOrder.customer.name}</div>
              </Link>
            </section>

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
