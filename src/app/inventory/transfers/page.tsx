import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { ProductService } from "@/domains/products/services/product-service";
import { WarehouseService } from "@/domains/warehouses/services/warehouse-service";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";

import { TransferForm } from "./transfer-form";

export const metadata: Metadata = { title: "Warehouse Transfers" };

export default async function TransfersPage() {
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
          <h1 className="text-2xl font-semibold tracking-normal">Warehouse Transfers</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Move stock between warehouses. Each transfer creates two ledger entries per line (OUT from source, IN to destination)
            and generates a unique Warehouse Transfer (WT) document number.
          </p>
        </div>

        <TransferForm
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
