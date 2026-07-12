"use client";

import { Search, ArrowUpDown, Warehouse } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

type WarehouseInfo = {
  id: string;
  name: string;
  code: string;
};

type WarehouseStock = {
  onHand: string;
  reserved: string;
  available: string;
};

type StockRow = {
  id: string;
  sku: string;
  name: string;
  status: string;
  unit: string;
  totals: { onHand: number; reserved: number; available: number };
  perWarehouse: Record<string, WarehouseStock>;
};

type SortKey = "sku" | "name" | "onHand" | "available" | "status";
type SortDir = "asc" | "desc";

export function StockByProductTable({
  rows,
  warehouses,
}: {
  rows: StockRow[];
  warehouses: WarehouseInfo[];
}) {
  const [search, setSearch] = useState("");
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("");
  const [sortKey, setSortKey] = useState<SortKey>("onHand");
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
    return rows
      .filter((row) => {
        if (query && !row.sku.toLowerCase().includes(query) && !row.name.toLowerCase().includes(query)) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        const dir = sortDir === "asc" ? 1 : -1;
        if (sortKey === "onHand") return (a.totals.onHand - b.totals.onHand) * dir;
        if (sortKey === "available") return (a.totals.available - b.totals.available) * dir;
        if (sortKey === "sku") return a.sku.localeCompare(b.sku) * dir;
        if (sortKey === "name") return a.name.localeCompare(b.name) * dir;
        if (sortKey === "status") return a.status.localeCompare(b.status) * dir;
        return 0;
      });
  }, [rows, search, sortKey, sortDir]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative max-w-sm grow">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary"
            placeholder="Search by SKU or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Warehouse className="size-4 text-muted-foreground" />
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
          >
            <option value="">All warehouses</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/70 text-xs font-semibold uppercase text-muted-foreground">
            <tr className="border-b">
              <Th onClick={() => toggleSort("sku")} active={sortKey === "sku"}>
                SKU
              </Th>
              <Th onClick={() => toggleSort("name")} active={sortKey === "name"}>
                Product
              </Th>
              <Th onClick={() => toggleSort("onHand")} active={sortKey === "onHand"} align="right">
                On Hand
              </Th>
              <th className="h-10 px-3 text-right text-xs font-semibold text-muted-foreground">Reserved</th>
              <Th onClick={() => toggleSort("available")} active={sortKey === "available"} align="right">
                Available
              </Th>
              {!selectedWarehouse
                ? warehouses.map((w) => (
                    <th key={w.id} className="h-10 px-3 text-right text-xs font-semibold text-muted-foreground">
                      {w.code}
                    </th>
                  ))
                : null}
              <Th onClick={() => toggleSort("status")} active={sortKey === "status"}>
                Status
              </Th>
              <th className="h-10 w-20 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.id} className="border-b last:border-b-0 hover:bg-muted/30">
                <td className="h-10 px-3 font-mono text-xs">{row.sku}</td>
                <td className="h-10 px-3 font-medium">{row.name}</td>
                <td className={`h-10 px-3 text-right font-mono tabular-nums ${!selectedWarehouse ? "font-semibold" : ""}`}>
                  {selectedWarehouse
                    ? (Number(row.perWarehouse[selectedWarehouse]?.onHand ?? "0") > 0
                        ? row.perWarehouse[selectedWarehouse].onHand
                        : <span className="text-muted-foreground">0</span>)
                    : (row.totals.onHand > 0 ? row.totals.onHand.toFixed(3) : <span className="text-muted-foreground">0</span>)}
                </td>
                <td className={`h-10 px-3 text-right font-mono tabular-nums ${!selectedWarehouse ? "" : ""}`}>
                  <span className="text-amber-600">
                    {selectedWarehouse
                      ? (Number(row.perWarehouse[selectedWarehouse]?.reserved ?? "0") > 0
                          ? row.perWarehouse[selectedWarehouse].reserved
                          : <span className="text-muted-foreground">0</span>)
                      : (row.totals.reserved > 0 ? row.totals.reserved.toFixed(3) : <span className="text-muted-foreground">0</span>)}
                  </span>
                </td>
                <td className={`h-10 px-3 text-right font-mono tabular-nums ${!selectedWarehouse ? "font-semibold" : ""}`}>
                  {selectedWarehouse
                    ? (Number(row.perWarehouse[selectedWarehouse]?.available ?? "0") > 0
                        ? row.perWarehouse[selectedWarehouse].available
                        : <span className="text-destructive">0</span>)
                    : (row.totals.available > 0 ? row.totals.available.toFixed(3) : <span className="text-destructive">0</span>)}
                </td>
                {!selectedWarehouse
                  ? warehouses.map((w) => {
                      const whStock = row.perWarehouse[w.id];
                      const parts = whStock
                        ? `${Number(whStock.onHand) > 0 ? whStock.onHand : "0"}/${Number(whStock.reserved) > 0 ? whStock.reserved : "0"}/${Number(whStock.available) > 0 ? whStock.available : "0"}`
                        : "-/-/-";
                      return (
                        <td key={w.id} className="h-10 px-3 text-right font-mono text-xs tabular-nums text-muted-foreground">
                          {parts}
                        </td>
                      );
                    })
                  : null}
                <td className="h-10 px-3">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      row.status === "ACTIVE"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {row.status}
                  </span>
                </td>
                <td className="h-10 px-3 text-right">
                  <Link
                    href={`/inventory/movements/${row.id}`}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    History
                  </Link>
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={warehouses.length + 7} className="h-20 text-center text-sm text-muted-foreground">
                  {search ? "No products match your search." : "No products found."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">{filtered.length} of {rows.length} products</p>
    </div>
  );
}

function Th({
  children,
  onClick,
  active,
  align,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`h-10 cursor-pointer select-none px-3 text-xs font-semibold uppercase transition hover:text-foreground ${align === "right" ? "text-right" : "text-left"}`}
      onClick={onClick}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        <ArrowUpDown className={`size-3 ${active ? "text-foreground" : "opacity-40"}`} />
      </span>
    </th>
  );
}
