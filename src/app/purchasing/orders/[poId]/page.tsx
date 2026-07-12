import { ArrowLeft, CheckCircle, Send, XCircle } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { PurchaseOrderRepository } from "@/domains/purchasing/repositories/purchase-order-repository";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";

import { statusColorClass, formatStatus } from "@/components/status-colors";
import { PurchaseOrderActions } from "./purchase-order-actions";
import { getEntityTimeline } from "@/app/entity-timeline";
import { DocumentTimeline } from "@/app/document-timeline";

export async function generateMetadata({ params }: { params: Promise<{ poId: string }> }): Promise<Metadata> {
  const { poId } = await params;
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  const order = await new PurchaseOrderRepository().findById(context.organizationId, poId);

  if (!order) {
    return { title: "Not Found" };
  }

  return { title: order.poNumber };
}

export default async function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ poId: string }>;
}) {
  const { poId } = await params;
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  const order = await new PurchaseOrderRepository().findById(context.organizationId, poId);

  if (!order) {
    notFound();
  }

  const timeline = await getEntityTimeline(context.organizationId, "PurchaseOrder", order.id);

  const statusIcon: Record<string, React.ReactNode> = {
    DRAFT: <Send className="size-4" />,
    PENDING_APPROVAL: <Send className="size-4" />,
    APPROVED: <CheckCircle className="size-4" />,
    FULLY_RECEIVED: <CheckCircle className="size-4" />,
    CANCELLED: <XCircle className="size-4" />,
  };

  const archiveableStatuses = ["APPROVED", "PARTIALLY_RECEIVED", "FULLY_RECEIVED", "CANCELLED"];
  const showActions = ["DRAFT", "PENDING_APPROVAL", ...archiveableStatuses].includes(order.status) && !order.archivedAt;
  const showEdit = order.status === "DRAFT";

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="border-b pb-6">
          <div className="flex items-start justify-between">
            <div>
              <Link
                href="/purchasing/orders"
                className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="size-3" />
                Back to Orders
              </Link>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-normal">{order.poNumber}</h1>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-xs font-medium ${
                    statusColorClass(order.status)
                  }`}
                >
                  {statusIcon[order.status]}
                  {formatStatus(order.status)}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {order.supplier.name} &middot; Ordered {new Date(order.orderedAt).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {showEdit ? (
                <Link
                  href={`/purchasing/orders/${poId}/edit`}
                  className="inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium transition hover:bg-muted"
                >
                  Edit
                </Link>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <section className="rounded-lg border p-5">
              <h2 className="text-sm font-semibold">Line Items</h2>
              <div className="mt-3 overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/70 text-xs font-semibold uppercase text-muted-foreground">
                    <tr className="border-b">
                      <th className="h-10 px-3 text-left">#</th>
                      <th className="h-10 px-3 text-left">Product</th>
                      <th className="h-10 px-3 text-right">Ordered</th>
                      <th className="h-10 px-3 text-right">Received</th>
                      <th className="h-10 px-3 text-right">Remaining</th>
                      <th className="h-10 px-3 text-right">Unit Cost</th>
                      <th className="h-10 px-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.lines.map((line) => (
                      <tr key={line.id} className="border-b last:border-b-0 hover:bg-muted/30">
                        <td className="h-10 px-3 text-muted-foreground">{line.lineNumber}</td>
                        <td className="h-10 px-3">
                          <span className="font-medium">{line.product.name}</span>
                          <span className="ml-2 font-mono text-xs text-muted-foreground">{line.product.sku}</span>
                          {line.description ? (
                            <p className="text-xs text-muted-foreground">{line.description}</p>
                          ) : null}
                        </td>
                        <td className="h-10 px-3 text-right font-mono tabular-nums">
                          {Number(line.orderedQuantity).toFixed(3)} {line.unitOfMeasure.code}
                        </td>
                        <td className="h-10 px-3 text-right font-mono tabular-nums text-muted-foreground">
                          {Number(line.receivedQuantity).toFixed(3)}
                        </td>
                        <td className="h-10 px-3 text-right font-mono tabular-nums">
                          {(Number(line.orderedQuantity) - Number(line.receivedQuantity)).toFixed(3)}
                        </td>
                        <td className="h-10 px-3 text-right font-mono tabular-nums">
                          {Number(line.unitCost).toFixed(3)}
                        </td>
                        <td className="h-10 px-3 text-right font-mono tabular-nums font-semibold">
                          {Number(line.totalCost).toFixed(3)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-lg border p-5">
              <h2 className="text-sm font-semibold">Summary</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Subtotal</dt>
                  <dd className="font-mono tabular-nums">{Number(order.subtotal).toFixed(3)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Tax</dt>
                  <dd className="font-mono tabular-nums">{Number(order.taxAmount).toFixed(3)}</dd>
                </div>
                <div className="flex justify-between border-t pt-2 font-semibold">
                  <dt>Total</dt>
                  <dd className="font-mono tabular-nums">{Number(order.totalAmount).toFixed(3)}</dd>
                </div>
                <div className="flex justify-between pt-2">
                  <dt className="text-muted-foreground">Currency</dt>
                  <dd>{order.currency}</dd>
                </div>
              </dl>
            </section>

            <section className="rounded-lg border p-5">
              <h2 className="text-sm font-semibold">Details</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Created by</dt>
                  <dd>{order.createdBy?.name ?? order.createdBy?.email ?? "Unknown"}</dd>
                </div>
                {order.approvedBy ? (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Approved by</dt>
                    <dd>{order.approvedBy.name ?? order.approvedBy.email}</dd>
                  </div>
                ) : null}
                {order.archivedBy ? (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Archived by</dt>
                    <dd>{order.archivedBy.name ?? order.archivedBy.email}</dd>
                  </div>
                ) : null}
                {order.archivedAt ? (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Archived at</dt>
                    <dd>{new Date(order.archivedAt).toLocaleString()}</dd>
                  </div>
                ) : null}
                {order.expectedDeliveryDate ? (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Expected</dt>
                    <dd>{new Date(order.expectedDeliveryDate).toLocaleDateString()}</dd>
                  </div>
                ) : null}
                {order.deliveryAddress ? (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Delivery</dt>
                    <dd className="text-right">{order.deliveryAddress}</dd>
                  </div>
                ) : null}
                {order.notes ? (
                  <div>
                    <dt className="text-muted-foreground">Notes</dt>
                    <dd className="mt-1 text-xs">{order.notes}</dd>
                  </div>
                ) : null}
              </dl>
            </section>

            {showActions ? (
              <section className="rounded-lg border p-5">
                <h2 className="text-sm font-semibold">Actions</h2>
                <div className="mt-3 space-y-2">
                  <PurchaseOrderActions
                    poId={poId}
                    status={order.status}
                    archivedAt={order.archivedAt?.toISOString() ?? null}
                  />
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
