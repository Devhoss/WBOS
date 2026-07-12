import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { AdjustmentReasonService } from "@/domains/inventory/services/adjustment-reason-service";
import { ProductService } from "@/domains/products/services/product-service";
import { WarehouseService } from "@/domains/warehouses/services/warehouse-service";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";

import { AdjustmentForm } from "./adjustment-form";

export const metadata: Metadata = { title: "Inventory Adjustments" };

export default async function AdjustmentsPage() {
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  const [products, warehouses, reasons] = await Promise.all([
    new ProductService().listForCatalog(context),
    new WarehouseService().listActive(context),
    new AdjustmentReasonService().listActive(context.organizationId),
  ]);
  const activeProducts = products.filter((product) => product.status === "ACTIVE" && !product.archivedAt);

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="border-b pb-6">
          <h1 className="text-2xl font-semibold tracking-normal">Inventory Adjustments</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Correct inventory discrepancies. Every adjustment requires a reason and creates an immutable ledger entry.
            Each adjustment generates a unique Adjustment (ADJ) document number.
          </p>
        </div>

        <AdjustmentForm
          products={activeProducts.map((product) => ({
            id: product.id,
            sku: product.sku,
            name: product.name,
          }))}
          warehouses={warehouses.map((warehouse) => ({
            id: warehouse.id,
            name: warehouse.name,
            code: warehouse.code,
          }))}
          reasons={reasons.map((reason) => ({
            code: reason.code,
            name: reason.name,
            direction: reason.direction,
          }))}
        />
      </div>
    </AppShell>
  );
}
