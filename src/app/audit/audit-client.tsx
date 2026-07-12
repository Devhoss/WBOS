"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, ChevronLeft, ChevronRight, Filter, Clock } from "lucide-react";

import { getAuditLogs, getDistinctEntityTypes } from "@/domains/activity/services/audit-actions";

type AuditEntry = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  metadata: unknown;
  createdAt: Date;
  user: { name: string; email: string } | null;
};

type PageData = {
  items: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

const actionLabels: Record<string, string> = {
  ORGANIZATION_ONBOARDED: "Organization Onboarded",
  PRODUCT_CREATED: "Product Created",
  PRODUCT_UPDATED: "Product Updated",
  PRODUCT_ARCHIVED: "Product Archived",
  PRODUCT_ACTIVATED: "Product Activated",
  CATEGORY_CREATED: "Category Created",
  CATEGORY_UPDATED: "Category Updated",
  CUSTOMER_CREATED: "Customer Created",
  CUSTOMER_UPDATED: "Customer Updated",
  SUPPLIER_CREATED: "Supplier Created",
  SUPPLIER_UPDATED: "Supplier Updated",
  WAREHOUSE_CREATED: "Warehouse Created",
  WAREHOUSE_UPDATED: "Warehouse Updated",
  SALES_ORDER_CREATED: "Sales Order Created",
  SALES_ORDER_SUBMITTED: "Sales Order Submitted",
  SALES_ORDER_APPROVED: "Sales Order Approved",
  SALES_ORDER_CANCELLED: "Sales Order Cancelled",
  PURCHASE_ORDER_CREATED: "Purchase Order Created",
  PURCHASE_ORDER_SUBMITTED: "PO Submitted",
  PURCHASE_ORDER_APPROVED: "PO Approved",
  PURCHASE_ORDER_CANCELLED: "PO Cancelled",
  INVOICE_ISSUED: "Invoice Issued",
  PAYMENT_RECORDED: "Payment Recorded",
  SHIPMENT_CREATED: "Shipment Created",
  SHIPMENT_DELIVERED: "Shipment Delivered",
  INVENTORY_ADJUSTED: "Inventory Adjusted",
  GOODS_RECEIVED: "Goods Received",
  INVENTORY_TRANSFERRED: "Inventory Transferred",
  BUSINESS_SETTINGS_UPDATED: "Settings Updated",
  CYCLE_COUNT_CREATED: "Cycle Count Created",
  CYCLE_COUNT_COMPLETED: "Cycle Count Completed",
  CYCLE_COUNT_APPROVED: "Cycle Count Approved",
  UNIT_OF_MEASURE_CREATED: "UoM Created",
  UNIT_OF_MEASURE_UPDATED: "UoM Updated",
};

function formatAction(action: string): string {
  return actionLabels[action] || action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(d: Date): string {
  return new Date(d).toLocaleString();
}

export function AuditClient() {
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const [types, setTypes] = useState<string[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    getDistinctEntityTypes().then(setTypes).catch(() => {});
  }, []);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getAuditLogs({
        page,
        search: search || undefined,
        entityType: entityType || undefined,
        action: action || undefined,
      });
      setData(result as unknown as PageData);
    } catch {
      setError("Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  }, [page, search, entityType, action]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  function handleSearch() {
    setPage(1);
    fetchLogs();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSearch();
  }

  if (error) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary"
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search audit logs..."
            type="text"
            value={search}
          />
        </div>
        <select
          className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
          onChange={(e) => { setEntityType(e.target.value); setPage(1); }}
          value={entityType}
        >
          <option value="">All types</option>
          {types.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select
          className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
          onChange={(e) => { setAction(e.target.value); setPage(1); }}
          value={action}
        >
          <option value="">All actions</option>
          {Object.entries(actionLabels).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <button
          className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          onClick={handleSearch}
          type="button"
        >
          <Filter className="size-4" />
          Filter
        </button>
      </div>

      {loading ? (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          Loading...
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          No audit log entries found.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Action</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Entity</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Summary</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">User</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.items.map((entry) => (
                  <tr key={entry.id} className="transition hover:bg-muted/20">
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="size-3.5" />
                        {formatDate(entry.createdAt)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
                        {formatAction(entry.action)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{entry.entityType}</td>
                    <td className="max-w-xs truncate px-4 py-3">{entry.summary}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {entry.user ? entry.user.name || entry.user.email : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <p>
              {data.total} total entries &middot; Page {data.page} of {data.totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border bg-background transition hover:bg-muted disabled:opacity-40"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                type="button"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border bg-background transition hover:bg-muted disabled:opacity-40"
                disabled={page >= (data?.totalPages ?? 1)}
                onClick={() => setPage(page + 1)}
                type="button"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
