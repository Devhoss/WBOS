import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { BarcodeLookup } from "@/components/barcode-lookup";
import { ProductService } from "@/domains/products/services/product-service";
import { StockBalanceService } from "@/domains/inventory/services/stock-balance-service";
import { WarehouseService } from "@/domains/warehouses/services/warehouse-service";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";

import { StockByProductTable } from "./stock-by-product-table";

export const metadata: Metadata = { title: "Stock by Product" };

export default async function StockByProductPage() {
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  const [products, details, warehouses] = await Promise.all([
    new ProductService().listForCatalog(context),
    new StockBalanceService().getStockBalancesDetail(context.organizationId),
    new WarehouseService().listActive(context),
  ]);

  const perWarehouseMap = new Map<string, Map<string, { onHand: string; reserved: string; available: string }>>();
  const totalMap = new Map<string, { onHand: number; reserved: number; available: number }>();

  for (const detail of details) {
    const productBalances = perWarehouseMap.get(detail.productId) ?? new Map();
    productBalances.set(detail.warehouseId, {
      onHand: Number(detail.onHand).toFixed(3),
      reserved: Number(detail.reserved).toFixed(3),
      available: Number(detail.available).toFixed(3),
    });
    perWarehouseMap.set(detail.productId, productBalances);

    const totals = totalMap.get(detail.productId) ?? { onHand: 0, reserved: 0, available: 0 };
    totals.onHand += Number(detail.onHand);
    totals.reserved += Number(detail.reserved);
    totals.available += Number(detail.available);
    totalMap.set(detail.productId, totals);
  }

  const stockRows = products
    .filter((p) => !p.archivedAt)
    .map((product) => {
      const warehouseBalances = perWarehouseMap.get(product.id);
      const perWarehouse = Object.fromEntries(
        warehouses.map((w) => [
          w.id,
          warehouseBalances?.get(w.id) ?? { onHand: "0.000", reserved: "0.000", available: "0.000" },
        ]),
      );
      const totals = totalMap.get(product.id) ?? { onHand: 0, reserved: 0, available: 0 };
      return {
        id: product.id,
        sku: product.sku,
        name: product.name,
        status: product.status,
        unit: product.unitOfMeasure.code,
        totals,
        perWarehouse,
      };
    })
    .sort((a, b) => b.totals.onHand - a.totals.onHand);

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="border-b pb-6">
          <h1 className="text-2xl font-semibold tracking-normal">Stock by Product</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Current stock quantities across all warehouses showing On Hand, Reserved, and Available balances.
          </p>
        </div>

        <BarcodeLookup />

        <StockByProductTable
          rows={stockRows}
          warehouses={warehouses.map((w) => ({ id: w.id, name: w.name, code: w.code }))}
        />
      </div>
    </AppShell>
  );
}
