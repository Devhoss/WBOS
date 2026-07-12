import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { WarehouseRepository } from "@/domains/warehouses/repositories/warehouse-repository";
import { prisma } from "@/infrastructure/database/prisma";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";

import { ShipmentLinesForm } from "../shipment-lines-form";

export const metadata: Metadata = { title: "New Shipment" };

export default async function NewShipmentPage({ searchParams }: { searchParams: Promise<{ salesOrderId?: string }> }) {
  const params = await searchParams;
  const context = await new AuthenticatedRequestContextService().getCurrentContext();

  const [orders, warehouses] = await Promise.all([
    prisma.salesOrder.findMany({
      where: {
        organizationId: context.organizationId,
        status: { in: ["APPROVED", "READY_FOR_INVOICE", "INVOICED"] },
      },
      include: {
        customer: { select: { id: true, name: true } },
        lines: {
          select: {
            id: true, productId: true, orderedQuantity: true, shippedQuantity: true,
            productName: true, productSku: true, unitOfMeasureCode: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    new WarehouseRepository().listActive(context.organizationId),
  ]);

  const availableOrders = orders.map((o) => ({
    id: o.id, soNumber: o.soNumber, customerName: o.customer.name,
    lines: o.lines
      .filter((l) => Number(l.orderedQuantity) > Number(l.shippedQuantity))
      .map((l) => ({
        id: l.id, productId: l.productId, productName: l.productName, productSku: l.productSku,
        orderedQuantity: Number(l.orderedQuantity), shippedQuantity: Number(l.shippedQuantity),
        unitOfMeasureCode: l.unitOfMeasureCode,
      })),
  })).filter((o) => o.lines.length > 0);

  const preselectedOrderId = params.salesOrderId;
  if (preselectedOrderId && !availableOrders.some((o) => o.id === preselectedOrderId)) {
    const directOrder = await prisma.salesOrder.findFirst({
      where: { id: preselectedOrderId, organizationId: context.organizationId },
      include: {
        customer: { select: { id: true, name: true } },
        lines: {
          select: {
            id: true, productId: true, orderedQuantity: true, shippedQuantity: true,
            productName: true, productSku: true, unitOfMeasureCode: true,
          },
        },
      },
    });
    if (!directOrder) notFound();
    availableOrders.push({
      id: directOrder.id, soNumber: directOrder.soNumber, customerName: directOrder.customer.name,
      lines: directOrder.lines
        .filter((l) => Number(l.orderedQuantity) > Number(l.shippedQuantity))
        .map((l) => ({
          id: l.id, productId: l.productId, productName: l.productName, productSku: l.productSku,
          orderedQuantity: Number(l.orderedQuantity), shippedQuantity: Number(l.shippedQuantity),
          unitOfMeasureCode: l.unitOfMeasureCode,
        })),
    });
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="border-b pb-6">
          <Link href="/sales/shipments" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-3" />Back to Shipments
          </Link>
          <h1 className="text-2xl font-semibold tracking-normal">New Shipment</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Select a sales order and specify quantities to ship.</p>
        </div>

        <ShipmentLinesForm
          orders={availableOrders}
          preselectedOrderId={preselectedOrderId}
          warehouses={warehouses.map((w) => ({ id: w.id, name: w.name, code: w.code }))}
        />
      </div>
    </AppShell>
  );
}
