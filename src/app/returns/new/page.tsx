import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { CustomerRepository } from "@/domains/customers/repositories/customer-repository";
import { ProductService } from "@/domains/products/services/product-service";
import { SalesOrderRepository } from "@/domains/sales/repositories/sales-order-repository";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { ReturnForm } from "./return-form";

export const metadata: Metadata = { title: "New Return" };

export default async function NewReturnPage(props: { searchParams?: Promise<{ salesOrderId?: string; invoiceId?: string; customerId?: string }> }) {
  const searchParams = await props.searchParams;
  const preselectedSO = searchParams?.salesOrderId;
  const preselectedInvoice = searchParams?.invoiceId;
  const preselectedCustomerId = searchParams?.customerId;

  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  const [customers, products, salesOrders] = await Promise.all([
    new CustomerRepository().listActive(context.organizationId),
    new ProductService().listForCatalog(context),
    new SalesOrderRepository().listWithFilters(context.organizationId, { pageSize: 200 }),
  ]);

  const activeProducts = products.filter((p) => p.status === "ACTIVE" && !p.archivedAt);

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="border-b pb-6">
          <h1 className="text-2xl font-semibold tracking-normal">New Return</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Record a customer return. Link it to a sales order or invoice for credit processing.
          </p>
        </div>

        <ReturnForm
          preselectedSalesOrderId={preselectedSO}
          preselectedInvoiceId={preselectedInvoice}
          preselectedCustomerId={preselectedCustomerId}
          customers={customers.map((c) => ({ id: c.id, name: c.name, code: c.code }))}
          products={activeProducts.map((p) => ({
            id: p.id,
            sku: p.sku,
            name: p.name,
            defaultSellingPrice: Number(p.defaultSellingPrice ?? 0),
            unitOfMeasureId: p.unitOfMeasureId,
            unitOfMeasureCode: p.unitOfMeasure.code,
          }))}
          salesOrders={salesOrders.data.map((so) => ({
            id: so.id,
            soNumber: so.soNumber,
            customerId: so.customerId,
            customerName: so.customer.name,
          }))}
        />
      </div>
    </AppShell>
  );
}
