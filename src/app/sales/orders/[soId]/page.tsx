import {
  ArrowLeft,
  CheckCircle,
  FileText,
  Send,
  Truck,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { SalesOrderRepository } from "@/domains/sales/repositories/sales-order-repository";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";

import { statusColorClass, formatStatus } from "@/components/status-colors";
import { SalesOrderActions } from "./sales-order-actions";
import { SalesOrderInvoiceAction } from "./sales-order-invoice-action";
import { getEntityTimeline } from "@/app/entity-timeline";
import { DocumentTimeline } from "@/app/document-timeline";

const statusIcon: Record<string, React.ReactNode> = {
  DRAFT: <Send className="size-4" />,
  PENDING_APPROVAL: <Send className="size-4" />,
  APPROVED: <CheckCircle className="size-4" />,
  READY_FOR_INVOICE: <FileText className="size-4" />,
  INVOICED: <FileText className="size-4" />,
  PAID: <CheckCircle className="size-4" />,
  CANCELLED: <XCircle className="size-4" />,
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ soId: string }>;
}): Promise<Metadata> {
  const { soId } = await params;
  const context =
    await new AuthenticatedRequestContextService().getCurrentContext();
  const order = await new SalesOrderRepository().findById(
    context.organizationId,
    soId,
  );

  if (!order) {
    return { title: "Not Found" };
  }

  return { title: order.soNumber };
}

export default async function SalesOrderDetailPage({
  params,
}: {
  params: Promise<{ soId: string }>;
}) {
  const { soId } = await params;
  const context =
    await new AuthenticatedRequestContextService().getCurrentContext();
  const order = await new SalesOrderRepository().findById(
    context.organizationId,
    soId,
  );

  if (!order) notFound();

  const timeline = await getEntityTimeline(
    context.organizationId,
    "SalesOrder",
    order.id,
  );

  const archiveableSO = [
    "APPROVED",
    "READY_FOR_INVOICE",
    "INVOICED",
    "PAID",
    "CANCELLED",
  ];
  const showActions =
    ["DRAFT", "PENDING_APPROVAL", ...archiveableSO].includes(order.status) &&
    !order.archivedAt;
  const showEdit = order.status === "DRAFT";
  const showInvoice =
    order.status === "READY_FOR_INVOICE" || order.status === "APPROVED";
  const showShip =
    order.status === "APPROVED" ||
    order.status === "READY_FOR_INVOICE" ||
    order.status === "INVOICED";

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="border-b pb-6">
          <div className="flex items-start justify-between">
            <div>
              <Link
                href="/sales/orders"
                className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="size-3" />
                Back to Orders
              </Link>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-normal">
                  {order.soNumber}
                </h1>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-xs font-medium ${statusColorClass(order.status)}`}
                >
                  {statusIcon[order.status]}
                  {formatStatus(order.status)}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {order.customer.name} &middot; Ordered{" "}
                {new Date(order.orderedAt).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {showEdit ? (
                <Link
                  href={`/sales/orders/${soId}/edit`}
                  className="inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium transition hover:bg-muted"
                >
                  Edit
                </Link>
              ) : null}
              {showShip ? (
                <Link
                  href={`/sales/shipments/new?salesOrderId=${soId}`}
                  className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition hover:opacity-90"
                >
                  <Truck className="size-4" />
                  Create Shipment
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
                      <th className="h-10 px-3 text-right">Shipped</th>
                      <th className="h-10 px-3 text-right">PC/شد</th>
                      <th className="h-10 px-3 text-right">Unit Price</th>
                      <th className="h-10 px-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.lines.map((line) => (
                      <tr
                        key={line.id}
                        className="border-b last:border-b-0 hover:bg-muted/30"
                      >
                        <td className="h-10 px-3 text-muted-foreground">
                          {line.lineNumber}
                        </td>
                        <td className="h-10 px-3">
                          <span className="font-medium">
                            {line.productName}
                          </span>
                          <span className="ml-2 font-mono text-xs text-muted-foreground">
                            {line.productSku}
                          </span>
                        </td>
                        <td className="h-10 px-3 text-right font-mono tabular-nums">
                          {Number(line.orderedQuantity).toFixed(3)}
                        </td>
                        <td className="h-10 px-3 text-right font-mono tabular-nums text-muted-foreground">
                          {Number(line.shippedQuantity).toFixed(3)}
                        </td>
                        <td className="h-10 px-3 text-right font-mono tabular-nums text-muted-foreground">
                          {line.piecesPerBox
                            ? Number(line.piecesPerBox).toFixed(0)
                            : "-"}
                        </td>
                        <td className="h-10 px-3 text-right font-mono tabular-nums">
                          {Number(line.unitPrice).toFixed(3)}
                        </td>
                        <td className="h-10 px-3 text-right font-mono tabular-nums font-semibold">
                          {Number(line.totalPrice).toFixed(3)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {order.shipments.length > 0 ? (
              <section className="rounded-lg border p-5">
                <h2 className="text-sm font-semibold">Shipments</h2>
                <div className="mt-3 space-y-2">
                  {order.shipments.map((s) => (
                    <Link
                      key={s.id}
                      href={`/sales/shipments/${s.id}`}
                      className="flex items-center justify-between rounded-md border p-3 text-sm transition hover:bg-muted/30"
                    >
                      <span className="font-medium">{s.shipmentNumber}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatStatus(s.status)} &middot; {s.lines.length}{" "}
                        line(s)
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}

            {order.invoices.length > 0 ? (
              <section className="rounded-lg border p-5">
                <h2 className="text-sm font-semibold">Invoices</h2>
                <div className="mt-3 space-y-2">
                  {order.invoices.map((inv) => (
                    <Link
                      key={inv.id}
                      href={`/invoices/${inv.id}`}
                      className="flex items-center justify-between rounded-md border p-3 text-sm transition hover:bg-muted/30"
                    >
                      <span className="font-medium">{inv.invoiceNumber}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatStatus(inv.status)}
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}
          </div>

          <div className="space-y-6">
            <section className="rounded-lg border p-5">
              <h2 className="text-sm font-semibold">Summary</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Subtotal</dt>
                  <dd className="font-mono tabular-nums">
                    {Number(order.subtotal).toFixed(3)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Discount</dt>
                  <dd className="font-mono tabular-nums">
                    {Number(order.discountAmount).toFixed(3)}
                    {order.discountType ? (
                      <span className="ml-1 text-xs text-muted-foreground">
                        (
                        {order.discountType === "PERCENTAGE"
                          ? `${Number(order.discountRate ?? 0).toFixed(1)}%`
                          : "FIXED"}
                        )
                      </span>
                    ) : null}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Tax</dt>
                  <dd className="font-mono tabular-nums">
                    {Number(order.taxAmount).toFixed(3)}
                  </dd>
                </div>
                <div className="flex justify-between border-t pt-2 font-semibold">
                  <dt>Total</dt>
                  <dd className="font-mono tabular-nums">
                    {Number(order.totalAmount).toFixed(3)}
                  </dd>
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
                  <dd>
                    {order.createdBy?.name ??
                      order.createdBy?.email ??
                      "Unknown"}
                  </dd>
                </div>
                {order.approvedBy ? (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Approved by</dt>
                    <dd>{order.approvedBy.name}</dd>
                  </div>
                ) : null}
                {order.expectedShipDate ? (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Expected ship</dt>
                    <dd>
                      {new Date(order.expectedShipDate).toLocaleDateString()}
                    </dd>
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
                {order.customerReference ? (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Customer ref</dt>
                    <dd>{order.customerReference}</dd>
                  </div>
                ) : null}
              </dl>
            </section>

            {showActions ? (
              <section className="rounded-lg border p-5">
                <h2 className="text-sm font-semibold">Actions</h2>
                <div className="mt-3 space-y-2">
                  <SalesOrderActions
                    poId={soId}
                    status={order.status}
                    archivedAt={order.archivedAt?.toISOString() ?? null}
                  />
                </div>
              </section>
            ) : null}

            {showInvoice ? (
              <section className="rounded-lg border p-5">
                <h2 className="text-sm font-semibold">Invoicing</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {order.status === "APPROVED"
                    ? "An invoice will be auto-generated on approval. Click below to manually generate."
                    : "This order is ready for invoicing."}
                </p>
                <div className="mt-3">
                  <SalesOrderInvoiceAction soId={soId} />
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
