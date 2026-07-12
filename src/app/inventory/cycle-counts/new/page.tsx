import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { ProductService } from "@/domains/products/services/product-service";
import { StockBalanceService } from "@/domains/inventory/services/stock-balance-service";
import { WarehouseService } from "@/domains/warehouses/services/warehouse-service";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";

import { CycleCountForm } from "./cycle-count-form";

export const metadata: Metadata = { title: "New Cycle Count" };

export default async function NewCycleCountPage() {
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  const [products, warehouses, balances] = await Promise.all([
    new ProductService().listForCatalog(context),
    new WarehouseService().listActive(context),
    new StockBalanceService().getAllStockBalances(context.organizationId),
  ]);

  const byWarehouse = new Map<string, Map<string, string>>();
  for (const b of balances) {
    const wh = byWarehouse.get(b.warehouseId) ?? new Map();
    wh.set(b.productId, Number(b.quantity).toFixed(3));
    byWarehouse.set(b.warehouseId, wh);
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="border-b pb-6">
          <h1 className="text-2xl font-semibold tracking-normal">New Cycle Count</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Select a warehouse and add products to count. Expected quantities are pre-filled from the current stock balance.
          </p>
        </div>
        <CycleCountForm
          products={products.map((p) => ({ id: p.id, sku: p.sku, name: p.name }))}
          warehouses={warehouses.map((w) => ({ id: w.id, name: w.name, code: w.code }))}
          initialBalances={Object.fromEntries(
            [...byWarehouse.entries()].map(([whId, prods]) => [whId, Object.fromEntries(prods)]),
          )}
        />
      </div>
    </AppShell>
  );
}
