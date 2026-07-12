import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { ProductService } from "@/domains/products/services/product-service";
import { WarehouseService } from "@/domains/warehouses/services/warehouse-service";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";

import { ManualReceiptForm } from "./manual-receipt-form";

export const metadata: Metadata = { title: "Manual Receiving" };

export default async function ReceivingPage() {
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  const [products, warehouses] = await Promise.all([
    new ProductService().listForCatalog(context),
    new WarehouseService().listActive(context),
  ]);
  const activeProducts = products.filter((product) => product.status === "ACTIVE" && !product.archivedAt);

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="border-b pb-6">
          <h1 className="text-2xl font-semibold tracking-normal">Manual Receiving</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Add stock into a warehouse. Each receipt generates a Goods Receipt Note (GRN) and creates immutable ledger entries.
          </p>
        </div>

        <ManualReceiptForm
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
        />
      </div>
    </AppShell>
  );
}
