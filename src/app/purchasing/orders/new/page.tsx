import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { ProductService } from "@/domains/products/services/product-service";
import { SupplierRepository } from "@/domains/suppliers/repositories/supplier-repository";
import { UnitOfMeasureRepository } from "@/domains/units/repositories/unit-of-measure-repository";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";

import { PurchaseOrderForm } from "./purchase-order-form";

export const metadata: Metadata = { title: "New Purchase Order" };

export default async function NewPurchaseOrderPage() {
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  const [products, suppliers, units] = await Promise.all([
    new ProductService().listForCatalog(context),
    new SupplierRepository().listActive(context.organizationId),
    new UnitOfMeasureRepository().listActive(context.organizationId),
  ]);
  const activeProducts = products.filter(
    (product) => product.status === "ACTIVE" && !product.archivedAt,
  );

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="border-b pb-6">
          <h1 className="text-2xl font-semibold tracking-normal">New Purchase Order</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Create a new purchase order. Enter supplier details, line items with quantities and costs, then submit for
            approval.
          </p>
        </div>

        <PurchaseOrderForm
          products={activeProducts.map((p) => ({
            id: p.id,
            sku: p.sku,
            name: p.name,
          }))}
          suppliers={suppliers.map((s) => ({
            id: s.id,
            name: s.name,
          }))}
          units={units.map((u) => ({
            id: u.id,
            name: u.name,
            code: u.code,
          }))}
        />
      </div>
    </AppShell>
  );
}
