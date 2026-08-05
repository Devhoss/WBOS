import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { formatStatus, statusColorClass } from "@/components/status-colors";
import { prisma } from "@/infrastructure/database/prisma";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";

import { LandedCostService } from "@/domains/purchasing/services/landed-cost-service";

import { LandedCostAllocateForm } from "./landed-cost-allocate-form";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const context = await new AuthenticatedRequestContextService().getCurrentContext();

  const landedCost = await new LandedCostService().getById(context, id).catch(() => null);

  if (!landedCost) {
    return { title: "Not Found" };
  }

  return { title: `Allocate ${landedCost.lcNumber}` };
}

export default async function AllocateLandedCostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  const service = new LandedCostService();

  const landedCost = await service.getById(context, id).catch(() => null);

  if (!landedCost) {
    notFound();
  }

  if (landedCost.status !== "DRAFT") {
    notFound();
  }

  const preview = await service.preview(context, id);

  const productIds = landedCost.lines.map((line) => line.productId);
  const warehouseIds = landedCost.lines.map((line) => line.warehouseId);
  const unitIds = landedCost.lines.map((line) => line.unitOfMeasureId);

  const [products, warehouses, units] = await Promise.all([
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
  ]);

  const productMap = new Map(products.map((p) => [p.id, p]));
  const warehouseMap = new Map(warehouses.map((w) => [w.id, w]));
  const unitMap = new Map(units.map((u) => [u.id, u]));

  const lines = preview.lines.map((line) => ({
    id: line.id,
    productName: `${productMap.get(line.productId)?.sku ?? line.productId} - ${productMap.get(line.productId)?.name ?? "Unknown"}`,
    warehouseName: warehouseMap.get(line.warehouseId)?.name ?? "—",
    unitCode: unitMap.get(line.unitOfMeasureId)?.code ?? "",
    quantity: Number(line.quantity),
    invoiceValue: Number(line.invoiceValue),
    weightTotal: line.weightTotal === null ? null : Number(line.weightTotal),
    volumeTotal: line.volumeTotal === null ? null : Number(line.volumeTotal),
    onHand: Number(line.onHand),
    postingTreatment: (line.postingTreatment ?? "EXPENSED") as "CAPITALIZED" | "EXPENSED",
  }));

  const expenses = landedCost.expenses.map((expense) => ({
    id: expense.id,
    expenseType: expense.expenseType,
    description: expense.description,
    baseAmount: Number(expense.baseAmount),
    amount: Number(expense.amount),
    currency: expense.currency,
    exchangeRate: Number(expense.exchangeRate),
  }));

  const initialCells = landedCost.allocations.map((allocation) => ({
    lineId: allocation.lineId,
    expenseId: allocation.expenseId,
    amount: Number(allocation.amount),
  }));

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="border-b pb-6">
          <Link
            href={`/purchasing/landed-costs/${id}`}
            className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3" />
            Back to {landedCost.lcNumber}
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-normal">Allocate {landedCost.lcNumber}</h1>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-xs font-medium ${statusColorClass(landedCost.status)}`}
            >
              {formatStatus(landedCost.status)}
            </span>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Review how the landed cost is allocated across the received lines. Change the basis to re-compute, then post.
            Lines with zero on-hand are posted as EXPENSED to cost of goods.
          </p>
        </div>

        <LandedCostAllocateForm
          id={id}
          lcNumber={landedCost.lcNumber}
          currency={landedCost.currency}
          supplierName={landedCost.supplier?.name ?? "No supplier"}
          allocationBasis={landedCost.allocationBasis}
          lines={lines}
          expenses={expenses}
          initialCells={initialCells}
        />
      </div>
    </AppShell>
  );
}
