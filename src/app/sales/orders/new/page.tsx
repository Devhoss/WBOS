import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { CustomerRepository } from "@/domains/customers/repositories/customer-repository";
import { CustomerBalanceService } from "@/domains/sales/services/customer-balance-service";
import { ProductService } from "@/domains/products/services/product-service";
import { UnitOfMeasureRepository } from "@/domains/units/repositories/unit-of-measure-repository";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";

import { SalesOrderForm } from "./sales-order-form";

export const metadata: Metadata = { title: "New Sales Order" };

export default async function NewSalesOrderPage() {
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  const [products, customers, units] = await Promise.all([
    new ProductService().listForCatalog(context),
    new CustomerRepository().listActive(context.organizationId),
    new UnitOfMeasureRepository().listActive(context.organizationId),
  ]);
  const activeProducts = products.filter((p) => p.status === "ACTIVE" && !p.archivedAt);

  const balanceService = new CustomerBalanceService();
  const balancePromises = customers.map((c) =>
    balanceService.getBalanceSummary(context.organizationId, c.id).then((b) => ({
      customerId: c.id,
      ...b,
    })),
  );
  const balances = await Promise.all(balancePromises);
  const balanceMap = new Map(balances.map((b) => [b.customerId, b]));

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="border-b pb-6">
          <h1 className="text-2xl font-semibold tracking-normal">New Sales Order</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Create a new sales order. Unit prices pre-fill from the product catalog but can be overridden.
          </p>
        </div>

        <SalesOrderForm
          products={activeProducts.map((p) => ({
            id: p.id,
            sku: p.sku,
            name: p.name,
            defaultSellingPrice: Number(p.defaultSellingPrice ?? 0),
            unitOfMeasureId: p.unitOfMeasureId,
            unitOfMeasureCode: p.unitOfMeasure.code,
          }))}
          customers={customers.map((c) => ({
            id: c.id,
            name: c.name,
            code: c.code,
            creditLimit: Number(c.creditLimit ?? 0),
            outstanding: balanceMap.get(c.id)?.outstanding ?? 0,
            openInvoiceCount: balanceMap.get(c.id)?.openInvoiceCount ?? 0,
          }))}
          units={units.map((u) => ({ id: u.id, name: u.name, code: u.code }))}
        />
      </div>
    </AppShell>
  );
}
