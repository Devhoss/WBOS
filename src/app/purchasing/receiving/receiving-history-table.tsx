"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

type ReceiptRow = {
  id: string;
  documentNumber: string | null;
  referenceId: string | null;
  occurredAt: string;
  createdBy: string | null;
  notes: string | null;
  lineCount: number;
  products: Array<{
    sku: string;
    name: string;
    quantity: number;
    warehouse: string | null;
  }>;
};

export function ReceivingHistoryTable({
  receipts,
  total,
}: {
  receipts: ReceiptRow[];
  total: number;
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const query = search.toLowerCase();
    return receipts.filter((r) => {
      if (!query) return true;
      if (r.documentNumber?.toLowerCase().includes(query)) return true;
      return r.products.some(
        (p) => p.sku.toLowerCase().includes(query) || p.name.toLowerCase().includes(query),
      );
    });
  }, [receipts, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative max-w-sm grow">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary"
            placeholder="Search by GRN number or product..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Link
          href="/purchasing/receiving/new"
          className="ml-auto inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          Receive Goods
        </Link>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/70 text-xs font-semibold uppercase text-muted-foreground">
            <tr className="border-b">
              <th className="h-10 px-3 text-left">GRN</th>
              <th className="h-10 px-3 text-right">Lines</th>
              <th className="h-10 px-3 text-left">Products</th>
              <th className="h-10 px-3 text-left">Date</th>
              <th className="h-10 px-3 text-left">Received by</th>
              <th className="h-10 px-3 text-left">Notes</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((receipt) => (
              <tr key={receipt.id} className="border-b last:border-b-0 hover:bg-muted/30">
                <td className="h-10 px-3 font-mono text-xs font-medium">
                  {receipt.documentNumber ?? "-"}
                </td>
                <td className="h-10 px-3 text-right text-muted-foreground">{receipt.lineCount}</td>
                <td className="h-10 px-3">
                  <div className="flex flex-wrap gap-1">
                    {receipt.products.slice(0, 3).map((p, i) => (
                      <span key={i} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs">
                        {p.sku}
                        <span className="text-muted-foreground">x{Number(p.quantity).toFixed(1)}</span>
                      </span>
                    ))}
                    {receipt.products.length > 3 ? (
                      <span className="text-xs text-muted-foreground">+{receipt.products.length - 3} more</span>
                    ) : null}
                  </div>
                </td>
                <td className="h-10 px-3 text-muted-foreground">
                  {new Date(receipt.occurredAt).toLocaleDateString()}
                </td>
                <td className="h-10 px-3 text-muted-foreground">{receipt.createdBy ?? "System"}</td>
                <td className="h-10 max-w-48 truncate px-3 text-muted-foreground">{receipt.notes ?? "-"}</td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="h-20 text-center text-sm text-muted-foreground">
                  {search ? "No receipts match your search." : "No goods received yet."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">{filtered.length} of {total} receipts</p>
    </div>
  );
}
