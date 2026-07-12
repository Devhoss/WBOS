import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { InventoryTransactionRepository } from "@/domains/inventory/repositories/inventory-transaction-repository";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";

import { ReceivingHistoryTable } from "./receiving-history-table";

export const metadata: Metadata = { title: "Goods Receipt History" };

export default async function ReceivingHistoryPage() {
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  const transactions = await new InventoryTransactionRepository().listWithFilters(
    context.organizationId,
    { types: ["PURCHASE_RECEIPT"], take: 100 },
  );

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="border-b pb-6">
          <h1 className="text-2xl font-semibold tracking-normal">Goods Receipt History</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            All goods received against purchase orders. Each receipt creates permanent inventory ledger entries and
            generates a Goods Receipt Note (GRN).
          </p>
        </div>

        <ReceivingHistoryTable
          receipts={transactions.items.map((tx) => ({
            id: tx.id,
            documentNumber: tx.documentNumber,
            referenceId: tx.referenceId,
            occurredAt: tx.occurredAt.toISOString(),
            createdBy: tx.createdBy?.name ?? tx.createdBy?.email ?? null,
            notes: tx.notes,
            lineCount: tx.lines.length,
            products: tx.lines.map((line) => ({
              sku: line.product.sku,
              name: line.product.name,
              quantity: Number(line.quantity),
              warehouse: line.toWarehouse?.name ?? null,
            })),
          }))}
          total={transactions.total}
        />
      </div>
    </AppShell>
  );
}
