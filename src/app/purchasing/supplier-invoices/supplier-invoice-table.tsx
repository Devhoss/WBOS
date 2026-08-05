"use client";

import { ArrowUpDown, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { statusColorClass, formatStatus } from "@/components/status-colors";

type InvoiceRow = {
  id: string;
  siNumber: string;
  status: string;
  supplierName: string;
  reference: string;
  totalAmount: string;
  amountPaid: string;
  currency: string;
  dueDate: string | null;
  createdAt: string;
};

type SupplierOption = {
  id: string;
  name: string;
};

type SortKey = "siNumber" | "status" | "supplierName" | "totalAmount" | "dueDate" | "createdAt";
type SortDir = "asc" | "desc";

export function SupplierInvoiceTable({
  invoices,
  suppliers,
  total,
}: {
  invoices: InvoiceRow[];
  suppliers: SupplierOption[];
  total: number;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
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
    return invoices
      .filter((inv) => {
        if (query && !inv.siNumber.toLowerCase().includes(query) && !inv.supplierName.toLowerCase().includes(query) && !inv.reference.toLowerCase().includes(query)) {
          return false;
        }
        if (statusFilter && inv.status !== statusFilter) return false;
        if (supplierFilter && inv.supplierName !== supplierFilter) return false;
        return true;
      })
      .sort((a, b) => {
        const dir = sortDir === "asc" ? 1 : -1;
        if (sortKey === "totalAmount") return (Number(a.totalAmount) - Number(b.totalAmount)) * dir;
        if (sortKey === "siNumber") return a.siNumber.localeCompare(b.siNumber) * dir;
        if (sortKey === "supplierName") return a.supplierName.localeCompare(b.supplierName) * dir;
        if (sortKey === "status") return a.status.localeCompare(b.status) * dir;
        if (sortKey === "dueDate") {
          const aDate = a.dueDate ? new Date(a.dueDate).getTime() : 0;
          const bDate = b.dueDate ? new Date(b.dueDate).getTime() : 0;
          return (aDate - bDate) * dir;
        }
        return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir;
      });
  }, [invoices, search, statusFilter, supplierFilter, sortKey, sortDir]);

  const statuses = [...new Set(invoices.map((inv) => inv.status))];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative max-w-sm grow">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary"
            placeholder="Search by SIV number, supplier, or reference..."
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
          href="/purchasing/supplier-invoices/new"
          className="ml-auto inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          <Plus className="size-4" />
          New Supplier Invoice
        </Link>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/70 text-xs font-semibold uppercase text-muted-foreground">
            <tr className="border-b">
              <Th onClick={() => toggleSort("siNumber")} active={sortKey === "siNumber"}>SIV Number</Th>
              <Th onClick={() => toggleSort("status")} active={sortKey === "status"}>Status</Th>
              <Th onClick={() => toggleSort("supplierName")} active={sortKey === "supplierName"}>Supplier</Th>
              <Th onClick={() => toggleSort("totalAmount")} active={sortKey === "totalAmount"} align="right">Total ({invoices[0]?.currency ?? ""})</Th>
              <th className="h-10 px-3 text-right">Paid</th>
              <th className="h-10 px-3 text-right">Balance</th>
              <Th onClick={() => toggleSort("dueDate")} active={sortKey === "dueDate"}>Due</Th>
              <Th onClick={() => toggleSort("createdAt")} active={sortKey === "createdAt"}>Created</Th>
              <th className="h-10 w-20 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((inv) => {
              const balance = Number(inv.totalAmount) - Number(inv.amountPaid);
              return (
                <tr key={inv.id} className="border-b last:border-b-0 hover:bg-muted/30">
                  <td className="h-10 px-3 font-mono text-xs font-medium">{inv.siNumber}</td>
                  <td className="h-10 px-3">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusColorClass(inv.status)}`}>
                      {formatStatus(inv.status)}
                    </span>
                  </td>
                  <td className="h-10 px-3">{inv.supplierName}</td>
                  <td className="h-10 px-3 text-right font-mono tabular-nums">{inv.totalAmount}</td>
                  <td className="h-10 px-3 text-right font-mono tabular-nums text-emerald-600">{inv.amountPaid}</td>
                  <td className={`h-10 px-3 text-right font-mono tabular-nums ${balance > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                    {balance.toFixed(3)}
                  </td>
                  <td className="h-10 px-3 text-muted-foreground">
                    {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "-"}
                  </td>
                  <td className="h-10 px-3 text-muted-foreground">{new Date(inv.createdAt).toLocaleDateString()}</td>
                  <td className="h-10 px-3 text-right">
                    <Link
                      href={`/purchasing/supplier-invoices/${inv.id}`}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="h-20 text-center text-sm text-muted-foreground">
                  {search || statusFilter || supplierFilter ? "No supplier invoices match your filters." : "No supplier invoices yet."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">{filtered.length} of {total} supplier invoices</p>
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