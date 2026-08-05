"use client";

import { ArrowUpDown, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { statusColorClass, formatStatus } from "@/components/status-colors";

type LandedCostRow = {
  id: string;
  lcNumber: string;
  status: string;
  supplierName: string;
  totalExpense: number;
  currency: string;
  lineCount: number;
  receiptCount: number;
  postedBy: string | null;
  postingDate: string | null;
  createdAt: string;
};

type SortKey = "lcNumber" | "status" | "supplierName" | "totalExpense" | "createdAt";
type SortDir = "asc" | "desc";

export function LandedCostTable({
  landedCosts,
  total,
}: {
  landedCosts: LandedCostRow[];
  total: number;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
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
    return landedCosts
      .filter((lc) => {
        if (query && !lc.lcNumber.toLowerCase().includes(query) && !lc.supplierName.toLowerCase().includes(query)) {
          return false;
        }
        if (statusFilter && lc.status !== statusFilter) return false;
        return true;
      })
      .sort((a, b) => {
        const dir = sortDir === "asc" ? 1 : -1;
        if (sortKey === "totalExpense") return (a.totalExpense - b.totalExpense) * dir;
        if (sortKey === "lcNumber") return a.lcNumber.localeCompare(b.lcNumber) * dir;
        if (sortKey === "supplierName") return a.supplierName.localeCompare(b.supplierName) * dir;
        if (sortKey === "status") return a.status.localeCompare(b.status) * dir;
        return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir;
      });
  }, [landedCosts, search, statusFilter, sortKey, sortDir]);

  const statuses = [...new Set(landedCosts.map((lc) => lc.status))];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative max-w-sm grow">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary"
            placeholder="Search by LC number or supplier..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          {statuses.map((s) => (
            <option key={s} value={s}>{formatStatus(s)}</option>
          ))}
        </select>
        <Link
          href="/purchasing/landed-costs/new"
          className="ml-auto inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          <Plus className="size-4" />
          New Landed Cost
        </Link>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/70 text-xs font-semibold uppercase text-muted-foreground">
            <tr className="border-b">
              <Th onClick={() => toggleSort("lcNumber")} active={sortKey === "lcNumber"}>LC Number</Th>
              <Th onClick={() => toggleSort("status")} active={sortKey === "status"}>Status</Th>
              <Th onClick={() => toggleSort("supplierName")} active={sortKey === "supplierName"}>Supplier</Th>
              <Th onClick={() => toggleSort("totalExpense")} active={sortKey === "totalExpense"} align="right">Expenses ({landedCosts[0]?.currency ?? ""})</Th>
              <th className="h-10 px-3 text-right">Lines</th>
              <th className="h-10 px-3 text-right">Receipts</th>
              <Th onClick={() => toggleSort("createdAt")} active={sortKey === "createdAt"}>Created</Th>
              <th className="h-10 px-3 text-left">Posted by</th>
              <th className="h-10 w-20 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((lc) => (
              <tr key={lc.id} className="border-b last:border-b-0 hover:bg-muted/30">
                <td className="h-10 px-3 font-mono text-xs font-medium">{lc.lcNumber}</td>
                <td className="h-10 px-3">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusColorClass(lc.status)}`}>
                    {formatStatus(lc.status)}
                  </span>
                </td>
                <td className="h-10 px-3">{lc.supplierName}</td>
                <td className="h-10 px-3 text-right font-mono tabular-nums">{lc.totalExpense.toFixed(3)}</td>
                <td className="h-10 px-3 text-right text-muted-foreground">{lc.lineCount}</td>
                <td className="h-10 px-3 text-right text-muted-foreground">{lc.receiptCount}</td>
                <td className="h-10 px-3 text-muted-foreground">
                  {lc.postingDate ? new Date(lc.postingDate).toLocaleDateString() : new Date(lc.createdAt).toLocaleDateString()}
                </td>
                <td className="h-10 px-3 text-muted-foreground">{lc.postedBy ?? "—"}</td>
                <td className="h-10 px-3 text-right">
                  <Link
                    href={`/purchasing/landed-costs/${lc.id}`}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="h-20 text-center text-sm text-muted-foreground">
                  {search || statusFilter ? "No landed costs match your filters." : "No landed costs yet."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">{filtered.length} of {total} landed costs</p>
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
