import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { PurchaseOrderRepository } from "@/domains/purchasing/repositories/purchase-order-repository";
import { WarehouseRepository } from "@/domains/warehouses/repositories/warehouse-repository";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";

import { GoodsReceiptForm } from "./goods-receipt-form";

export const metadata: Metadata = { title: "Receive Goods" };

export default async function ReceiveGoodsPage() {
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  const [warehouses, approvedResult, partialResult] = await Promise.all([
    new WarehouseRepository().listActive(context.organizationId),
    new PurchaseOrderRepository().listWithFilters(context.organizationId, {
      status: "APPROVED",
      pageSize: 100,
    }),
    new PurchaseOrderRepository().listWithFilters(context.organizationId, {
      status: "PARTIALLY_RECEIVED",
      pageSize: 100,
    }),
  ]);

  const receivableOrders = [...approvedResult.data, ...partialResult.data];

  const ordersWithLines = await Promise.all(
    receivableOrders.map(async (o) => {
      const full = await new PurchaseOrderRepository().findById(context.organizationId, o.id);
      return full;
    }),
  );

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="border-b pb-6">
          <h1 className="text-2xl font-semibold tracking-normal">Receive Goods</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Record goods received against an approved purchase order. Partial receipts are supported; received quantities
            update the order line and post to inventory automatically.
          </p>
        </div>

        <GoodsReceiptForm
          orders={ordersWithLines
            .filter((o): o is NonNullable<typeof o> => o !== null)
            .map((o) => ({
              id: o.id,
              poNumber: o.poNumber,
              supplierName: o.supplier.name,
              lines: o.lines.map((line) => {
                const ordered = Number(line.orderedQuantity);
                const received = Number(line.receivedQuantity);
                return {
                  purchaseOrderLineId: line.id,
                  productId: line.product.id,
                  productName: line.product.name,
                  productSku: line.product.sku,
                  orderedQuantity: ordered,
                  alreadyReceived: received,
                  remaining: ordered - received,
                };
              }),
            }))}
          warehouses={warehouses.map((w) => ({
            id: w.id,
            name: w.name,
            code: w.code,
          }))}
        />
      </div>
    </AppShell>
  );
}
