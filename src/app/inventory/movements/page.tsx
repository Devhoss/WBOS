import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { InventoryTransactionRepository } from "@/domains/inventory/repositories/inventory-transaction-repository";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";

import { MovementHistoryTable } from "./movement-history-table";

export const metadata: Metadata = { title: "Movement History" };

export default async function MovementHistoryPage() {
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  const transactions = await new InventoryTransactionRepository().listWithFilters(
    context.organizationId,
    { take: 100 },
  );

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="border-b pb-6">
          <h1 className="text-2xl font-semibold tracking-normal">Movement History</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Complete history of all inventory transactions. Every movement creates permanent, immutable ledger entries.
          </p>
        </div>

        <MovementHistoryTable
          transactions={transactions.items.map((tx) => ({
            id: tx.id,
            documentNumber: tx.documentNumber,
            type: tx.type,
            occurredAt: tx.occurredAt.toISOString(),
            createdBy: tx.createdBy?.name ?? tx.createdBy?.email ?? null,
            notes: tx.notes,
            lineCount: tx.lines.length,
            products: tx.lines.map((line) => ({
              sku: line.product.sku,
              name: line.product.name,
              quantity: Number(line.quantity),
            })),
          }))}
          total={transactions.total}
        />
      </div>
    </AppShell>
  );
}
