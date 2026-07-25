import { ArrowLeft, CheckCircle, RotateCcw, XCircle } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { ReturnOrderService } from "@/domains/returns/services/return-order-service";
import { WarehouseRepository } from "@/domains/warehouses/repositories/warehouse-repository";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { prisma } from "@/infrastructure/database/prisma";
import { getEntityTimeline } from "@/app/entity-timeline";
import { DocumentTimeline } from "@/app/document-timeline";
import { formatStatus } from "@/components/status-colors";
import { ReturnActions } from "./return-actions";

const statusColors: Record<string, string> = {
  OPEN: "bg-yellow-100 text-yellow-800",
  RECEIVED: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-gray-100 text-gray-500",
};

const statusIcons: Record<string, React.ReactNode> = {
  OPEN: <RotateCcw className="size-4" />,
  RECEIVED: <CheckCircle className="size-4" />,
  COMPLETED: <CheckCircle className="size-4" />,
  CANCELLED: <XCircle className="size-4" />,
};

export async function generateMetadata({ params }: { params: Promise<{ returnId: string }> }): Promise<Metadata> {
  const { returnId } = await params;
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  const returnOrder = await new ReturnOrderService().findById(context.organizationId, returnId);
  if (!returnOrder) return { title: "Not Found" };
  return { title: returnOrder.returnNumber };
}

export default async function ReturnDetailPage({ params }: { params: Promise<{ returnId: string }> }) {
  const { returnId } = await params;
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  const returnOrder = await new ReturnOrderService().findById(context.organizationId, returnId);
  if (!returnOrder) notFound();

  const timeline = await getEntityTimeline(context.organizationId, "ReturnOrder", returnOrder.id);

  const warehouses = await new WarehouseRepository().listActive(context.organizationId);
  const defaultWarehouseId = warehouses.find((w) => w.isDefault)?.id ?? warehouses[0]?.id;

  const shipments = returnOrder.salesOrder
    ? await prisma.shipment.findMany({
        where: { salesOrderId: returnOrder.salesOrder.id, organizationId: context.organizationId },
        select: { id: true, shipmentNumber: true, status: true, deliveredAt: true },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const lineCount = returnOrder.lines.length;

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="border-b pb-6">
          <div className="flex items-start justify-between">
            <div>
              <Link href="/returns" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="size-3.5" /> Back to Returns
              </Link>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-semibold tracking-normal">{returnOrder.returnNumber}</span>
                <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${statusColors[returnOrder.status]}`}>
                  {statusIcons[returnOrder.status]}
                  {returnOrder.status}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Customer</p>
            <p className="text-sm font-medium">{returnOrder.customer.name}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Reason</p>
            <p className="text-sm capitalize font-medium">
              {returnOrder.reason?.toLowerCase().replace(/_/g, " ")}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Created</p>
            <p className="text-sm font-medium">
              {new Date(returnOrder.createdAt).toLocaleDateString()} by {returnOrder.createdBy?.name}
            </p>
          </div>

          {returnOrder.salesOrder && (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Sales Order</p>
              <Link href={`/sales/orders/${returnOrder.salesOrder.id}`} className="text-sm font-medium text-primary hover:underline">
                {returnOrder.salesOrder.soNumber}
              </Link>
            </div>
          )}

          {returnOrder.invoice && (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Invoice</p>
              <Link href={`/invoices/${returnOrder.invoice.id}`} className="text-sm font-medium text-primary hover:underline">
                {returnOrder.invoice.invoiceNumber}
              </Link>
            </div>
          )}

          {returnOrder.creditNote && (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Credit Note</p>
              <Link href={`/credit-notes/${returnOrder.creditNote.id}`} className="text-sm font-medium text-primary hover:underline">
                {returnOrder.creditNote.creditNoteNumber} ({formatStatus(returnOrder.creditNote.status)})
              </Link>
            </div>
          )}

          {shipments.length > 0 && (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Shipments</p>
              <div className="space-y-1">
                {shipments.map((s) => (
                  <Link key={s.id} href={`/sales/shipments/${s.id}`} className="block text-sm font-medium text-primary hover:underline">
                    {s.shipmentNumber}
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({formatStatus(s.status)}{s.deliveredAt ? ` · ${new Date(s.deliveredAt).toLocaleDateString()}` : ""})
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {returnOrder.notes && (
            <div className="col-span-3 space-y-1">
              <p className="text-sm text-muted-foreground">Notes</p>
              <p className="text-sm">{returnOrder.notes}</p>
            </div>
          )}
        </div>

        <div>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            Items ({lineCount} line{lineCount !== 1 ? "s" : ""})
          </h2>
          <div className="rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">#</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Product</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Expected</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Received</th>
                  <th className="px-4 py-2.5 text-center font-medium text-muted-foreground">Condition</th>
                  <th className="px-4 py-2.5 text-center font-medium text-muted-foreground">Disposition</th>
                </tr>
              </thead>
              <tbody>
                {returnOrder.lines.map((line) => (
                  <tr key={line.id} className="border-b last:border-0">
                    <td className="px-4 py-2.5 text-muted-foreground">{line.lineNumber}</td>
                    <td className="px-4 py-2.5 font-medium">
                      {line.product?.name ?? line.productId}
                      {line.product?.sku ? <span className="ml-2 font-mono text-xs text-muted-foreground">{line.product.sku}</span> : null}
                    </td>
                    <td className="px-4 py-2.5 text-right">{Number(line.expectedQuantity).toFixed(3)}</td>
                    <td className="px-4 py-2.5 text-right">{Number(line.receivedQuantity).toFixed(3)}</td>
                    <td className="px-4 py-2.5 text-center capitalize">
                      {line.condition?.toLowerCase() ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-center capitalize">
                      {line.disposition?.toLowerCase() ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="no-print">
          <ReturnActions
    returnOrder={JSON.parse(JSON.stringify(returnOrder))}
    warehouses={warehouses.map((w) => ({ id: w.id, name: w.name, code: w.code }))}
    defaultWarehouseId={defaultWarehouseId ?? ""}
  />
        </div>

        <div className="no-print">
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Timeline</h2>
          <DocumentTimeline entries={timeline} />
        </div>
      </div>
    </AppShell>
  );
}
