"use client";

import { useState, useEffect } from "react";

import { ReportLayout } from "../../components/report-layout";
import { ReportTable } from "../../components/report-table";
import { ExportButton } from "../../components/export-button";
import { PrintButton } from "../../components/print-button";
import { getCustomerStatement } from "@/domains/reports/services/report-actions";
import type { ReportColumn } from "@/domains/reports/dto/report-types";

const columns: ReportColumn[] = [
  { key: "date", label: "Date", format: "date" },
  { key: "document", label: "Document" },
  { key: "description", label: "Description" },
  { key: "debit", label: "Debit", align: "right", format: "currency" },
  { key: "credit", label: "Credit", align: "right", format: "currency" },
  { key: "balance", label: "Balance", align: "right", format: "currency" },
];

type Customer = { id: string; name: string };

export function CustomerStatementClient() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/customers").then((r) => r.json()).then(setCustomers).catch(() => {});
  }, []);

  async function handleGenerate() {
    if (!customerId) return;
    setLoading(true);
    try {
      const result = await getCustomerStatement(customerId, {
        dateRange: { from: from ? new Date(from) : null, to: to ? new Date(to) : null },
        warehouseId: null, customerId, supplierId: null, search: "",
      });
      setData(result as unknown as Record<string, unknown>[]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ReportLayout
      title="Customer Statement"
      description="View detailed statement for a specific customer"
      actions={
        <div className="flex gap-2">
          <ExportButton data={data} columns={columns} filename="customer-statement" />
          <PrintButton />
        </div>
      }
    >
      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="cust">Customer</label>
          <select
            className="h-9 w-60 rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
            id="cust"
            onChange={(e) => setCustomerId(e.target.value)}
            value={customerId}
          >
            <option value="">Select customer...</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="from">From</label>
          <input
            className="h-9 w-40 rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
            id="from"
            onChange={(e) => setFrom(e.target.value)}
            type="date"
            value={from}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="to">To</label>
          <input
            className="h-9 w-40 rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
            id="to"
            onChange={(e) => setTo(e.target.value)}
            type="date"
            value={to}
          />
        </div>
        <button
          className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          disabled={!customerId || loading}
          onClick={handleGenerate}
          type="button"
        >
          {loading ? "Loading..." : "Generate"}
        </button>
      </div>
      <div className="mt-4">
        <ReportTable columns={columns} rows={data} />
      </div>
    </ReportLayout>
  );
}
