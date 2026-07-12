import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { BarcodeLookup } from "@/components/barcode-lookup";
import { CategoryService } from "@/domains/categories/services/category-service";
import { ProductService } from "@/domains/products/services/product-service";
import { SupplierService } from "@/domains/suppliers/services/supplier-service";
import { UnitOfMeasureService } from "@/domains/units/services/unit-of-measure-service";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";

import { ProductForm } from "./product-form";
import { ProductTable } from "./product-table";

export const metadata: Metadata = { title: "Products" };

export default async function ProductsPage() {
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  const [products, categories, suppliers, units] = await Promise.all([
    new ProductService().listForCatalog(context),
    new CategoryService().listActive(context),
    new SupplierService().listActive(context),
    new UnitOfMeasureService().listActive(context),
  ]);

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="border-b pb-6">
          <h1 className="text-2xl font-semibold tracking-normal">Products</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Manage catalog items. Inventory quantities are not stored here; stock is created later through inventory transactions.
          </p>
        </div>

        <ProductForm
          categories={categories.map((category) => ({ id: category.id, name: category.name, code: category.code }))}
          suppliers={suppliers.map((supplier) => ({ id: supplier.id, name: supplier.name, code: supplier.code }))}
          units={units.map((unit) => ({ id: unit.id, name: unit.name, code: unit.code }))}
        />

        <BarcodeLookup />

        <ProductTable
          categories={categories.map((category) => ({ id: category.id, name: category.name, code: category.code }))}
          products={products.map((product) => ({
            id: product.id,
            sku: product.sku,
            barcode: product.barcode,
            name: product.name,
            description: product.description,
            categoryId: product.categoryId,
            category: product.category.name,
            supplierId: product.supplierId,
            unitOfMeasureId: product.unitOfMeasureId,
            unit: product.unitOfMeasure.code,
            status: product.status,
            defaultSellingPrice: product.defaultSellingPrice?.toString() ?? null,
            defaultCurrency: product.defaultCurrency,
            defaultPrice: product.defaultSellingPrice
              ? `${product.defaultSellingPrice.toString()} ${product.defaultCurrency}`
              : null,
            supplier: product.supplier?.name ?? null,
          }))}
          suppliers={suppliers.map((supplier) => ({ id: supplier.id, name: supplier.name, code: supplier.code }))}
          units={units.map((unit) => ({ id: unit.id, name: unit.name, code: unit.code }))}
        />
      </div>
    </AppShell>
  );
}
