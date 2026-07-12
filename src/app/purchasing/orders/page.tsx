import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { PurchaseOrderRepository } from "@/domains/purchasing/repositories/purchase-order-repository";
import { SupplierRepository } from "@/domains/suppliers/repositories/supplier-repository";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";

import { PurchaseOrderTable } from "./purchase-order-table";

export const metadata: Metadata = { title: "Purchase Orders" };

export default async function PurchaseOrdersPage(props: { searchParams?: Promise<{ archived?: string }> }) {
  const searchParams = await props.searchParams;
  const showArchived = searchParams?.archived === "1";
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  const [result, suppliers] = await Promise.all([
    new PurchaseOrderRepository().listWithFilters(context.organizationId, { pageSize: 50, archived: showArchived }),
    new SupplierRepository().listActive(context.organizationId),
  ]);

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="border-b pb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-normal">Purchase Orders</h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                All purchase orders across all statuses. Create, submit, approve, and track receipts.
              </p>
            </div>
            <a
              href={showArchived ? "/purchasing/orders" : "/purchasing/orders?archived=1"}
              className="inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium transition hover:bg-muted"
            >
              {showArchived ? "Active Orders" : "Archived Orders"}
            </a>
          </div>
        </div>

        <PurchaseOrderTable
          orders={result.data.map((order) => ({
            id: order.id,
            poNumber: order.poNumber,
            status: order.status,
            supplierName: order.supplier.name,
            totalAmount: Number(order.totalAmount).toFixed(3),
            currency: order.currency,
            lineCount: order._count.lines,
            createdBy: order.createdBy?.name ?? "",
            orderedAt: order.orderedAt.toISOString(),
            expectedDeliveryDate: order.expectedDeliveryDate?.toISOString() ?? null,
          }))}
          suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
          total={result.total}
          showArchived={showArchived}
        />
      </div>
    </AppShell>
  );
}
