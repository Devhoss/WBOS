import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { CustomerRepository } from "@/domains/customers/repositories/customer-repository";
import { SalesOrderRepository } from "@/domains/sales/repositories/sales-order-repository";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";

import { SalesOrderTable } from "./sales-order-table";

export const metadata: Metadata = { title: "Sales Orders" };

export default async function SalesOrdersPage(props: { searchParams?: Promise<{ archived?: string }> }) {
  const searchParams = await props.searchParams;
  const showArchived = searchParams?.archived === "1";
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  const [result, customers] = await Promise.all([
    new SalesOrderRepository().listWithFilters(context.organizationId, { pageSize: 50, archived: showArchived }),
    new CustomerRepository().listActive(context.organizationId),
  ]);

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="border-b pb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-normal">Sales Orders</h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                All sales orders across all statuses. Create, submit, approve, and track fulfillment.
              </p>
            </div>
            <a
              href={showArchived ? "/sales/orders" : "/sales/orders?archived=1"}
              className="inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium transition hover:bg-muted"
            >
              {showArchived ? "Active Orders" : "Archived Orders"}
            </a>
          </div>
        </div>

        <SalesOrderTable
          orders={result.data.map((o) => ({
            id: o.id,
            soNumber: o.soNumber,
            status: o.status,
            customerName: o.customer.name,
            totalAmount: Number(o.totalAmount).toFixed(3),
            currency: o.currency,
            lineCount: o._count.lines,
            shipmentCount: o._count.shipments,
            invoiceCount: o._count.invoices,
            createdBy: o.createdBy?.name ?? "",
            orderedAt: o.orderedAt.toISOString(),
          }))}
          customers={customers.map((c) => ({ id: c.id, name: c.name }))}
          total={result.total}
        />
      </div>
    </AppShell>
  );
}
