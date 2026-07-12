import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { InventoryLedgerRepository } from "@/domains/inventory/repositories/inventory-ledger-repository";
import { ProductRepository } from "@/domains/products/repositories/product-repository";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";

export async function generateMetadata(props: { params: Promise<{ productId: string }> }): Promise<Metadata> {
  const { productId } = await props.params;
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  const product = await new ProductRepository().findById(context.organizationId, productId);

  if (!product) {
    return { title: "Not Found" };
  }

  return { title: `${product.name} - Stock Card` };
}

export default async function ProductStockCardPage(props: { params: Promise<{ productId: string }> }) {
  const { productId } = await props.params;
  const context = await new AuthenticatedRequestContextService().getCurrentContext();

  const [product, entries] = await Promise.all([
    new ProductRepository().findById(context.organizationId, productId),
    new InventoryLedgerRepository().listForProduct(context.organizationId, productId),
  ]);

  if (!product) {
    notFound();
  }

  let runningBalance = 0;
  const rows = entries.map((entry) => {
    runningBalance += entry.direction === "IN" ? Number(entry.quantity) : -Number(entry.quantity);
    return {
      id: entry.id,
      date: entry.occurredAt.toISOString(),
      type: entry.movementType,
      direction: entry.direction,
      quantity: Number(entry.quantity),
      warehouse: entry.warehouse.name,
      warehouseCode: entry.warehouse.code,
      documentNumber: entry.transaction.documentNumber,
      runningBalance,
    };
  });

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-8">
        <div>
          <Link
            href="/inventory/stock"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3" />
            Back to Stock
          </Link>
        </div>

        <div className="border-b pb-6">
          <h1 className="text-2xl font-semibold tracking-normal">
            {product.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            SKU: {product.sku} &middot; Stock Card &mdash; Chronological ledger entries with running balance
          </p>
        </div>

        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/70 text-xs font-semibold uppercase text-muted-foreground">
              <tr className="border-b">
                <th className="h-10 px-3 text-left">Date</th>
                <th className="h-10 px-3 text-left">Document</th>
                <th className="h-10 px-3 text-left">Type</th>
                <th className="h-10 px-3 text-left">Warehouse</th>
                <th className="h-10 w-24 px-3 text-right">IN</th>
                <th className="h-10 w-24 px-3 text-right">OUT</th>
                <th className="h-10 w-24 px-3 text-right font-semibold">Balance</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="h-20 text-center text-sm text-muted-foreground">
                    No inventory history for this product.
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => (
                  <tr
                    key={row.id}
                    className={`border-b last:border-b-0 hover:bg-muted/30 ${
                      index === rows.length - 1 ? "bg-muted/20 font-medium" : ""
                    }`}
                  >
                    <td className="h-10 whitespace-nowrap px-3 text-xs">
                      {new Date(row.date).toLocaleDateString("en-KW", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="h-10 px-3 font-mono text-xs">
                      {row.documentNumber ?? <span className="text-muted-foreground">-</span>}
                    </td>
                    <td className="h-10 px-3 text-xs">
                      <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium capitalize">
                        {row.type.replace(/_/g, " ").toLowerCase()}
                      </span>
                    </td>
                    <td className="h-10 px-3 text-xs text-muted-foreground">
                      {row.warehouse} ({row.warehouseCode})
                    </td>
                    <td className="h-10 px-3 text-right font-mono text-xs tabular-nums text-emerald-600 dark:text-emerald-400">
                      {row.direction === "IN" ? row.quantity : ""}
                    </td>
                    <td className="h-10 px-3 text-right font-mono text-xs tabular-nums text-red-600 dark:text-red-400">
                      {row.direction === "OUT" ? row.quantity : ""}
                    </td>
                    <td className="h-10 px-3 text-right font-mono text-sm tabular-nums font-semibold">
                      {row.runningBalance}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {rows.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Current stock: {rows[rows.length - 1].runningBalance} &middot; {rows.length} ledger entr{rows.length === 1 ? "y" : "ies"}
          </p>
        )}
      </div>
    </AppShell>
  );
}
