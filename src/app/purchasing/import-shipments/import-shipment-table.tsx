"use client";

import { ArrowUpDown, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import type { DerivedShipmentState } from "@/domains/import-shipments/stage/compute-shipment-state";
import { stageLabel } from "@/domains/import-shipments/stage/compute-shipment-state";

type ShipmentRow = {
  id: string;
  shipmentNumber: string;
  supplierName: string;
  containerRef: string;
  eta: string | null;
  createdAt: string;
  state: DerivedShipmentState;
};

type SupplierOption = {
  id: string;
  name: string;
};

type SortKey = "shipmentNumber" | "supplierName" | "eta" | "createdAt" | "progress";
type SortDir = "asc" | "desc";

export function ImportShipmentTable({
  shipments,
  suppliers,
  total,
}: {
  shipments: ShipmentRow[];
  suppliers: SupplierOption[];
  total: number;
}) {
  const [search, setSearch] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
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
    return shipments
      .filter((s) => {
        if (query && !s.shipmentNumber.toLowerCase().includes(query) && !s.supplierName.toLowerCase().includes(query) && !s.containerRef.toLowerCase().includes(query)) {
          return false;
        }
        if (supplierFilter && s.supplierName !== supplierFilter) return false;
        return true;
      })
      .sort((a, b) => {
        const dir = sortDir === "asc" ? 1 : -1;
        if (sortKey === "shipmentNumber") return a.shipmentNumber.localeCompare(b.shipmentNumber) * dir;
        if (sortKey === "supplierName") return a.supplierName.localeCompare(b.supplierName) * dir;
        if (sortKey === "progress") return (a.state.progress - b.state.progress) * dir;
        if (sortKey === "eta") {
          const aDate = a.eta ? new Date(a.eta).getTime() : 0;
          const bDate = b.eta ? new Date(b.eta).getTime() : 0;
          return (aDate - bDate) * dir;
        }
        return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir;
      });
  }, [shipments, search, supplierFilter, sortKey, sortDir]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative max-w-sm grow">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary"
            placeholder="Search by shipment number, supplier, or container..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
          value={supplierFilter}
          onChange={(e) => setSupplierFilter(e.target.value)}
        >
          <option value="">All suppliers</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.name}>{s.name}</option>
          ))}
        </select>
        <Link
          href="/purchasing/import-shipments/new"
          className="ml-auto inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          <Plus className="size-4" />
          New Import Shipment
        </Link>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/70 text-xs font-semibold uppercase text-muted-foreground">
            <tr className="border-b">
              <Th onClick={() => toggleSort("shipmentNumber")} active={sortKey === "shipmentNumber"}>Shipment #</Th>
              <Th onClick={() => toggleSort("supplierName")} active={sortKey === "supplierName"}>Supplier</Th>
              <th className="h-10 px-3 text-left">Stage</th>
              <Th onClick={() => toggleSort("progress")} active={sortKey === "progress"}>Progress</Th>
              <th className="h-10 px-3 text-left">Container</th>
              <Th onClick={() => toggleSort("eta")} active={sortKey === "eta"}>ETA</Th>
              <Th onClick={() => toggleSort("createdAt")} active={sortKey === "createdAt"}>Created</Th>
              <th className="h-10 w-20 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id} className="border-b last:border-b-0 hover:bg-muted/30">
                <td className="h-10 px-3 font-mono text-xs font-medium">{s.shipmentNumber}</td>
                <td className="h-10 px-3">{s.supplierName}</td>
                <td className="h-10 px-3">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      s.state.stage === "COMPLETED"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                    }`}
                  >
                    {stageLabel(s.state.stage)}
                  </span>
                </td>
                <td className="h-10 px-3">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${s.state.progress}%` }} />
                    </div>
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">{s.state.progress}%</span>
                  </div>
                </td>
                <td className="h-10 px-3 font-mono text-xs text-muted-foreground">{s.containerRef || "-"}</td>
                <td className="h-10 px-3 text-muted-foreground">{s.eta ? new Date(s.eta).toLocaleDateString() : "-"}</td>
                <td className="h-10 px-3 text-muted-foreground">{new Date(s.createdAt).toLocaleDateString()}</td>
                <td className="h-10 px-3 text-right">
                  <Link
                    href={`/purchasing/import-shipments/${s.id}`}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="h-20 text-center text-sm text-muted-foreground">
                  {search || supplierFilter ? "No import shipments match your filters." : "No import shipments yet."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">{filtered.length} of {total} import shipments</p>
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