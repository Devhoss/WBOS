import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { prisma } from "@/infrastructure/database/prisma";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";

import { LandedCostService } from "@/domains/purchasing/services/landed-cost-service";
import { SupplierRepository } from "@/domains/suppliers/repositories/supplier-repository";

import { LandedCostEditForm } from "./landed-cost-edit-form";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const context = await new AuthenticatedRequestContextService().getCurrentContext();

  const landedCost = await new LandedCostService().getById(context, id).catch(() => null);

  if (!landedCost) {
    return { title: "Not Found" };
  }

  return { title: `Edit ${landedCost.lcNumber}` };
}

export default async function EditLandedCostPage({ params }: { params: Promise<{ id: string }> }) {
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

  const [suppliers, products, warehouses, units] = await Promise.all([
    new SupplierRepository().listActive(context.organizationId),
    prisma.product.findMany({
      where: { id: { in: landedCost.lines.map((line) => line.productId) }, organizationId: context.organizationId },
      select: { id: true, sku: true, name: true },
    }),
    prisma.warehouse.findMany({
      where: { id: { in: landedCost.lines.map((line) => line.warehouseId) }, organizationId: context.organizationId },
      select: { id: true, name: true, code: true },
    }),
    prisma.unitOfMeasure.findMany({
      where: { id: { in: landedCost.lines.map((line) => line.unitOfMeasureId) }, organizationId: context.organizationId },
      select: { id: true, code: true },
    }),
  ]);

  const productMap = new Map(products.map((p) => [p.id, p]));
  const warehouseMap = new Map(warehouses.map((w) => [w.id, w]));
  const unitMap = new Map(units.map((u) => [u.id, u]));

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
          <h1 className="text-2xl font-semibold tracking-normal">Edit {landedCost.lcNumber}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Adjust the supplier, expenses, and line basis values. Lines are locked to the linked goods receipts.
          </p>
        </div>

        <LandedCostEditForm
          id={id}
          lcNumber={landedCost.lcNumber}
          suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
          initial={{
            supplierId: landedCost.supplierId ?? "",
            allocationBasis: landedCost.allocationBasis,
            postingDate: landedCost.postingDate?.toISOString().slice(0, 10) ?? "",
            currency: landedCost.currency,
            exchangeRate: landedCost.exchangeRate.toString(),
            notes: landedCost.notes ?? "",
          }}
          expenses={landedCost.expenses.map((e) => ({
            id: e.id,
            expenseType: e.expenseType,
            description: e.description ?? "",
            currency: e.currency,
            exchangeRate: e.exchangeRate.toString(),
            amount: e.amount.toString(),
          }))}
          lines={landedCost.lines.map((line) => ({
            id: line.id,
            productName: `${productMap.get(line.productId)?.sku ?? line.productId} - ${productMap.get(line.productId)?.name ?? "Unknown"}`,
            warehouseName: warehouseMap.get(line.warehouseId)?.name ?? "—",
            unitCode: unitMap.get(line.unitOfMeasureId)?.code ?? "",
            quantity: Number(line.quantity),
            invoiceValue: line.invoiceValue.toString(),
            weightTotal: line.weightTotal?.toString() ?? "",
            volumeTotal: line.volumeTotal?.toString() ?? "",
          }))}
        />
      </div>
    </AppShell>
  );
}
