import { ArrowLeft, CheckCircle, Send, XCircle } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { formatStatus, statusColorClass } from "@/components/status-colors";
import { getEntityTimeline } from "@/app/entity-timeline";
import { DocumentTimeline } from "@/app/document-timeline";
import { prisma } from "@/infrastructure/database/prisma";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";

import { LandedCostService } from "@/domains/purchasing/services/landed-cost-service";
import { LandedCostActions } from "./landed-cost-actions";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const context = await new AuthenticatedRequestContextService().getCurrentContext();

  const landedCost = await new LandedCostService().getById(context, id).catch(() => null);

  if (!landedCost) {
    return { title: "Not Found" };
  }

  return { title: landedCost.lcNumber };
}

export default async function LandedCostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  const service = new LandedCostService();

  const landedCost = await service.getById(context, id).catch(() => null);

  if (!landedCost) {
    notFound();
  }

  const timeline = await getEntityTimeline(context.organizationId, "LandedCost", landedCost.id);

  const productIds = landedCost.lines.map((line) => line.productId);
  const warehouseIds = landedCost.lines.map((line) => line.warehouseId);
  const unitIds = landedCost.lines.map((line) => line.unitOfMeasureId);

  const [products, warehouses, units, receipts] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: productIds }, organizationId: context.organizationId },
      select: { id: true, sku: true, name: true },
    }),
    prisma.warehouse.findMany({
      where: { id: { in: warehouseIds }, organizationId: context.organizationId },
      select: { id: true, name: true, code: true },
    }),
    prisma.unitOfMeasure.findMany({
      where: { id: { in: unitIds }, organizationId: context.organizationId },
      select: { id: true, code: true },
    }),
    prisma.inventoryTransaction.findMany({
      where: {
        id: { in: landedCost.receipts.map((receipt) => receipt.inventoryTransactionId) },
        organizationId: context.organizationId,
      },
      select: { id: true, documentNumber: true, occurredAt: true },
    }),
  ]);

  const productMap = new Map(products.map((p) => [p.id, p]));
  const warehouseMap = new Map(warehouses.map((w) => [w.id, w]));
  const unitMap = new Map(units.map((u) => [u.id, u]));
  const receiptMap = new Map(receipts.map((r) => [r.id, r]));

  const allocationMap = new Map<string, string[]>();
  for (const allocation of landedCost.allocations) {
    const current = allocationMap.get(allocation.lineId) ?? [];
    allocationMap.set(allocation.lineId, [...current, allocation.amount.toString()]);
  }

  const totalAllocated = landedCost.allocations.reduce((sum, allocation) => sum + Number(allocation.amount), 0);

  const statusIcon: Record<string, React.ReactNode> = {
    DRAFT: <Send className="size-4" />,
    POSTED: <CheckCircle className="size-4" />,
    CANCELLED: <XCircle className="size-4" />,
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="border-b pb-6">
          <div className="flex items-start justify-between">
            <div>
              <Link
                href="/purchasing/landed-costs"
                className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="size-3" />
                Back to Landed Costs
              </Link>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-normal">{landedCost.lcNumber}</h1>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-xs font-medium ${statusColorClass(landedCost.status)}`}
                >
                  {statusIcon[landedCost.status]}
                  {formatStatus(landedCost.status)}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {landedCost.supplier?.name ?? "No supplier"} &middot; Created{" "}
                {new Date(landedCost.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {landedCost.status === "DRAFT" ? (
                <>
                  <Link
                    href={`/purchasing/landed-costs/${id}/edit`}
                    className="inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium transition hover:bg-muted"
                  >
                    Edit
                  </Link>
                  <Link
                    href={`/purchasing/landed-costs/${id}/allocate`}
                    className="inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium transition hover:bg-muted"
                  >
                    Allocate &amp; Post
                  </Link>
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <section className="rounded-lg border p-5">
              <h2 className="text-sm font-semibold">Expenses</h2>
              <div className="mt-3 overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/70 text-xs font-semibold uppercase text-muted-foreground">
                    <tr className="border-b">
                      <th className="h-10 px-3 text-left">Type</th>
                      <th className="h-10 px-3 text-left">Description</th>
                      <th className="h-10 px-3 text-right">Amount</th>
                      <th className="h-10 px-3 text-right">Rate</th>
                      <th className="h-10 px-3 text-right">Base ({landedCost.currency})</th>
                    </tr>
                  </thead>
                  <tbody>
                    {landedCost.expenses.map((expense) => (
                      <tr key={expense.id} className="border-b last:border-b-0 hover:bg-muted/30">
                        <td className="h-10 px-3 font-medium">{formatStatus(expense.expenseType)}</td>
                        <td className="h-10 px-3 text-muted-foreground">{expense.description ?? "—"}</td>
                        <td className="h-10 px-3 text-right font-mono tabular-nums">
                          {Number(expense.amount).toFixed(3)} {expense.currency}
                        </td>
                        <td className="h-10 px-3 text-right font-mono tabular-nums text-muted-foreground">
                          {Number(expense.exchangeRate).toFixed(4)}
                        </td>
                        <td className="h-10 px-3 text-right font-mono tabular-nums">
                          {Number(expense.baseAmount).toFixed(3)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-lg border p-5">
              <h2 className="text-sm font-semibold">Goods Receipts</h2>
              <div className="mt-3 space-y-2">
                {landedCost.receipts.map((receipt) => {
                  const transaction = receiptMap.get(receipt.inventoryTransactionId);
                  return (
                    <div key={receipt.id} className="rounded-md border p-3 text-sm">
                      <span className="font-mono text-xs font-medium">{transaction?.documentNumber ?? receipt.inventoryTransactionId}</span>
                      {transaction?.occurredAt ? (
                        <span className="ml-3 text-xs text-muted-foreground">
                          {new Date(transaction.occurredAt).toLocaleDateString()}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
                {landedCost.receipts.length === 0 ? (
                  <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">No goods receipts linked.</p>
                ) : null}
              </div>
            </section>

            <section className="rounded-lg border p-5">
              <h2 className="text-sm font-semibold">Lines &amp; Allocation</h2>
              <div className="mt-3 overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/70 text-xs font-semibold uppercase text-muted-foreground">
                    <tr className="border-b">
                      <th className="h-10 px-3 text-left">Product</th>
                      <th className="h-10 px-3 text-left">Warehouse</th>
                      <th className="h-10 px-3 text-right">Qty</th>
                      <th className="h-10 px-3 text-right">Invoice Value</th>
                      <th className="h-10 px-3 text-right">Allocated</th>
                      <th className="h-10 px-3 text-left">Treatment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {landedCost.lines.map((line) => {
                      const product = productMap.get(line.productId);
                      const warehouse = warehouseMap.get(line.warehouseId);
                      const unit = unitMap.get(line.unitOfMeasureId);
                      return (
                        <tr key={line.id} className="border-b last:border-b-0 hover:bg-muted/30">
                          <td className="h-10 px-3">
                            <span className="font-medium">{product?.name ?? "Unknown"}</span>
                            <span className="ml-2 font-mono text-xs text-muted-foreground">{product?.sku ?? line.productId}</span>
                          </td>
                          <td className="h-10 px-3 text-muted-foreground">{warehouse?.name ?? "—"}</td>
                          <td className="h-10 px-3 text-right font-mono tabular-nums">
                            {Number(line.quantity).toFixed(3)} {unit?.code ?? ""}
                          </td>
                          <td className="h-10 px-3 text-right font-mono tabular-nums">
                            {Number(line.invoiceValue).toFixed(3)}
                          </td>
                          <td className="h-10 px-3 text-right font-mono tabular-nums font-semibold">
                            {Number(line.allocatedAmount).toFixed(3)}
                          </td>
                          <td className="h-10 px-3">
                            {line.postingTreatment ? (
                              <span
                                className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${statusColorClass(line.postingTreatment)}`}
                              >
                                {line.postingTreatment}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
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
                  <dt className="text-muted-foreground">Allocation Basis</dt>
                  <dd>{formatStatus(landedCost.allocationBasis)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Expenses ({landedCost.currency})</dt>
                  <dd className="font-mono tabular-nums">
                    {landedCost.expenses.reduce((sum, expense) => sum + Number(expense.baseAmount), 0).toFixed(3)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Allocated</dt>
                  <dd className="font-mono tabular-nums">{Number(totalAllocated).toFixed(3)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Lines</dt>
                  <dd>{landedCost.lines.length}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Receipts</dt>
                  <dd>{landedCost.receipts.length}</dd>
                </div>
                {landedCost.postingDate ? (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Posting Date</dt>
                    <dd>{new Date(landedCost.postingDate).toLocaleDateString()}</dd>
                  </div>
                ) : null}
              </dl>
            </section>

            <section className="rounded-lg border p-5">
              <h2 className="text-sm font-semibold">Details</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Created by</dt>
                  <dd>{landedCost.createdBy?.name ?? landedCost.createdBy?.email ?? "Unknown"}</dd>
                </div>
                {landedCost.postedBy ? (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Posted by</dt>
                    <dd>{landedCost.postedBy.name ?? landedCost.postedBy.email}</dd>
                  </div>
                ) : null}
                {landedCost.postedAt ? (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Posted at</dt>
                    <dd>{new Date(landedCost.postedAt).toLocaleString()}</dd>
                  </div>
                ) : null}
                {landedCost.cancelledBy ? (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Cancelled by</dt>
                    <dd>{landedCost.cancelledBy.name ?? landedCost.cancelledBy.email}</dd>
                  </div>
                ) : null}
                {landedCost.cancelledAt ? (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Cancelled at</dt>
                    <dd>{new Date(landedCost.cancelledAt).toLocaleString()}</dd>
                  </div>
                ) : null}
                {landedCost.notes ? (
                  <div>
                    <dt className="text-muted-foreground">Notes</dt>
                    <dd className="mt-1 text-xs">{landedCost.notes}</dd>
                  </div>
                ) : null}
              </dl>
            </section>

            <LandedCostActions
              id={id}
              status={landedCost.status}
              canPost={landedCost.status === "DRAFT"}
              canCancel={landedCost.status === "POSTED"}
            />

            <DocumentTimeline entries={timeline} />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
