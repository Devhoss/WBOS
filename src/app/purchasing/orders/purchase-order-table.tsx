"use client";

import { ArrowUpDown, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { statusColorClass, formatStatus } from "@/components/status-colors";

type OrderRow = {
  id: string;
  poNumber: string;
  status: string;
  supplierName: string;
  totalAmount: string;
  currency: string;
  lineCount: number;
  createdBy: string;
  orderedAt: string;
  expectedDeliveryDate: string | null;
};

type SupplierOption = {
  id: string;
  name: string;
};

type SortKey = "poNumber" | "status" | "supplierName" | "totalAmount" | "orderedAt" | "expectedDeliveryDate";
type SortDir = "asc" | "desc";

export function PurchaseOrderTable({
  orders,
  suppliers,
  total,
}: {
  orders: OrderRow[];
  suppliers: SupplierOption[];
  total: number;
  showArchived?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("orderedAt");
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
    return orders
      .filter((o) => {
        if (query && !o.poNumber.toLowerCase().includes(query) && !o.supplierName.toLowerCase().includes(query)) {
          return false;
        }
        if (statusFilter && o.status !== statusFilter) return false;
        if (supplierFilter && o.supplierName !== supplierFilter) return false;
        return true;
      })
      .sort((a, b) => {
        const dir = sortDir === "asc" ? 1 : -1;
        if (sortKey === "totalAmount") return (Number(a.totalAmount) - Number(b.totalAmount)) * dir;
        if (sortKey === "poNumber") return a.poNumber.localeCompare(b.poNumber) * dir;
        if (sortKey === "supplierName") return a.supplierName.localeCompare(b.supplierName) * dir;
        if (sortKey === "status") return a.status.localeCompare(b.status) * dir;
        if (sortKey === "orderedAt") return new Date(a.orderedAt).getTime() - new Date(b.orderedAt).getTime() * dir;
        if (sortKey === "expectedDeliveryDate") {
          const aDate = a.expectedDeliveryDate ? new Date(a.expectedDeliveryDate).getTime() : 0;
          const bDate = b.expectedDeliveryDate ? new Date(b.expectedDeliveryDate).getTime() : 0;
          return (aDate - bDate) * dir;
        }
        return 0;
      });
  }, [orders, search, statusFilter, supplierFilter, sortKey, sortDir]);

  const statuses = [...new Set(orders.map((o) => o.status))];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative max-w-sm grow">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary"
            placeholder="Search by PO number or supplier..."
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
          href="/purchasing/orders/new"
          className="ml-auto inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          <Plus className="size-4" />
          New Order
        </Link>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/70 text-xs font-semibold uppercase text-muted-foreground">
            <tr className="border-b">
              <Th onClick={() => toggleSort("poNumber")} active={sortKey === "poNumber"}>PO Number</Th>
              <Th onClick={() => toggleSort("status")} active={sortKey === "status"}>Status</Th>
              <Th onClick={() => toggleSort("supplierName")} active={sortKey === "supplierName"}>Supplier</Th>
              <Th onClick={() => toggleSort("totalAmount")} active={sortKey === "totalAmount"} align="right">Total ({orders[0]?.currency ?? ""})</Th>
              <th className="h-10 px-3 text-left text-xs font-semibold">Lines</th>
              <Th onClick={() => toggleSort("orderedAt")} active={sortKey === "orderedAt"}>Ordered</Th>
              <Th onClick={() => toggleSort("expectedDeliveryDate")} active={sortKey === "expectedDeliveryDate"}>Expected</Th>
              <th className="h-10 w-20 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((order) => (
              <tr key={order.id} className="border-b last:border-b-0 hover:bg-muted/30">
                <td className="h-10 px-3 font-mono text-xs font-medium">{order.poNumber}</td>
                <td className="h-10 px-3">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusColorClass(order.status)}`}>
                    {formatStatus(order.status)}
                  </span>
                </td>
                <td className="h-10 px-3">{order.supplierName}</td>
                <td className="h-10 px-3 text-right font-mono tabular-nums">{order.totalAmount}</td>
                <td className="h-10 px-3 text-muted-foreground">{order.lineCount}</td>
                <td className="h-10 px-3 text-muted-foreground">{new Date(order.orderedAt).toLocaleDateString()}</td>
                <td className="h-10 px-3 text-muted-foreground">
                  {order.expectedDeliveryDate ? new Date(order.expectedDeliveryDate).toLocaleDateString() : "-"}
                </td>
                <td className="h-10 px-3 text-right">
                  <Link
                    href={`/purchasing/orders/${order.id}`}
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
                  {search || statusFilter || supplierFilter ? "No orders match your filters." : "No purchase orders yet."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">{filtered.length} of {total} orders</p>
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
