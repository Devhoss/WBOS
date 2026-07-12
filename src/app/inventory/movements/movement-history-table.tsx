"use client";

import { Search, ArrowUpDown } from "lucide-react";
import { useMemo, useState } from "react";

type MovementRow = {
  id: string;
  documentNumber: string | null;
  type: string;
  occurredAt: string;
  createdBy: string | null;
  notes: string | null;
  lineCount: number;
  products: Array<{ sku: string; name: string; quantity: number }>;
};

type SortKey = "occurredAt" | "type" | "documentNumber";
type SortDir = "asc" | "desc";

const typeLabels: Record<string, string> = {
  MANUAL_RECEIPT: "Manual Receipt",
  ADJUSTMENT_IN: "Adjustment In",
  ADJUSTMENT_OUT: "Adjustment Out",
  TRANSFER_OUT: "Transfer Out",
  TRANSFER_IN: "Transfer In",
  OPENING_BALANCE: "Opening Balance",
  PURCHASE_RECEIPT: "Purchase Receipt",
  SALE: "Sale",
  CUSTOMER_RETURN: "Customer Return",
  SUPPLIER_RETURN: "Supplier Return",
  DAMAGE: "Damage",
  EXPIRED: "Expired",
};

export function MovementHistoryTable({
  transactions,
  total,
}: {
  transactions: MovementRow[];
  total: number;
}) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [sortKey, setSortKey] = useState<SortKey>("occurredAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const filtered = useMemo(() => {
    const query = search.toLowerCase();
    return transactions
      .filter((tx) => {
        if (typeFilter && tx.type !== typeFilter) return false;
        if (query) {
          const docNum = tx.documentNumber?.toLowerCase() ?? "";
          const matchProduct = tx.products.some(
            (p) => p.sku.toLowerCase().includes(query) || p.name.toLowerCase().includes(query),
          );
          if (!docNum.includes(query) && !matchProduct) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const dir = sortDir === "asc" ? 1 : -1;
        if (sortKey === "occurredAt") return (new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()) * dir;
        if (sortKey === "type") return a.type.localeCompare(b.type) * dir;
        if (sortKey === "documentNumber") {
          const da = a.documentNumber ?? "";
          const db = b.documentNumber ?? "";
          return da.localeCompare(db) * dir;
        }
        return 0;
      });
  }, [transactions, search, typeFilter, sortKey, sortDir]);

  const uniqueTypes = [...new Set(transactions.map((tx) => tx.type))];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative max-w-xs grow">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary"
            placeholder="Search document # or product..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="">All types</option>
          {uniqueTypes.map((type) => (
            <option key={type} value={type}>
              {typeLabels[type] ?? type}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/70 text-xs font-semibold uppercase text-muted-foreground">
            <tr className="border-b">
              <Th onClick={() => toggleSort("documentNumber")} active={sortKey === "documentNumber"}>
                Document
              </Th>
              <Th onClick={() => toggleSort("type")} active={sortKey === "type"}>
                Type
              </Th>
              <Th onClick={() => toggleSort("occurredAt")} active={sortKey === "occurredAt"}>
                Date
              </Th>
              <th className="h-10 px-3 text-left">Products</th>
              <th className="h-10 px-3 text-left">Created By</th>
              <th className="h-10 px-3 text-left">Notes</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((tx) => (
              <tr key={tx.id} className="border-b last:border-b-0 hover:bg-muted/30">
                <td className="h-10 px-3 font-mono text-xs">
                  {tx.documentNumber ?? <span className="text-muted-foreground">-</span>}
                </td>
                <td className="h-10 px-3">
                  <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
                    {typeLabels[tx.type] ?? tx.type}
                  </span>
                </td>
                <td className="h-10 whitespace-nowrap px-3 text-xs">
                  {new Date(tx.occurredAt).toLocaleDateString("en-KW", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
                <td className="h-10 px-3 text-xs">
                  {tx.products.length <= 2
                    ? tx.products.map((p) => `${p.sku} ${p.name} (${p.quantity})`).join(", ")
                    : `${tx.products[0].sku} ${tx.products[0].name} (${tx.products[0].quantity}) +${tx.products.length - 1} more`}
                </td>
                <td className="h-10 px-3 text-xs text-muted-foreground">{tx.createdBy ?? "-"}</td>
                <td className="h-10 max-w-[200px] truncate px-3 text-xs text-muted-foreground">{tx.notes ?? "-"}</td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="h-20 text-center text-sm text-muted-foreground">
                  No transactions found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Showing {filtered.length} of {total} transactions
      </p>
    </div>
  );
}

function Th({
  children,
  onClick,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
}) {
  return (
    <th
      className="h-10 cursor-pointer select-none px-3 text-left text-xs font-semibold uppercase transition hover:text-foreground"
      onClick={onClick}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        <ArrowUpDown className={`size-3 ${active ? "text-foreground" : "opacity-40"}`} />
      </span>
    </th>
  );
}
