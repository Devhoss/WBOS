"use client";

import { useState, useEffect } from "react";

import { ReportLayout } from "../../components/report-layout";
import { ReportTable } from "../../components/report-table";
import { ExportButton } from "../../components/export-button";
import { PrintButton } from "../../components/print-button";
import { getProductCostHistory } from "@/domains/reports/services/report-actions";
import type { ReportColumn } from "@/domains/reports/dto/report-types";

const columns: ReportColumn[] = [
  { key: "occurredAt", label: "Date", format: "date" },
  { key: "documentNumber", label: "Document" },
  { key: "movementType", label: "Movement Type" },
  { key: "direction", label: "Direction" },
  { key: "quantity", label: "Quantity", align: "right", format: "number" },
  { key: "unitCost", label: "Unit Cost", align: "right", format: "currency" },
  { key: "totalCost", label: "Total Cost", align: "right", format: "currency" },
];

type ProductOption = { id: string; name: string; sku: string };
type WarehouseOption = { id: string; name: string };

export function ProductCostHistoryClient() {
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [productId, setProductId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/products").then((r) => r.json()),
      fetch("/api/warehouses").then((r) => r.json()),
    ])
      .then(([p, w]) => {
        setProducts(p);
        setWarehouses(w);
      })
      .catch(() => {});
  }, []);

  async function handleGenerate() {
    if (!productId) return;
    setLoading(true);
    try {
      const result = await getProductCostHistory(productId, warehouseId || null, {
        dateRange: { from: from ? new Date(from) : null, to: to ? new Date(to) : null },
        warehouseId: warehouseId || null,
        customerId: null,
        supplierId: null,
        search: "",
      });
      setData(result as unknown as Record<string, unknown>[]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ReportLayout
      title="Product Cost History"
      description="Every cost-affecting event for a product in a warehouse"
      actions={
        <div className="no-print flex gap-2">
          <ExportButton data={data} columns={columns} filename="product-cost-history" />
          <PrintButton />
        </div>
      }
    >
      <div className="no-print flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="prod">Product</label>
          <select
            className="h-9 w-60 rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
            id="prod"
            onChange={(e) => setProductId(e.target.value)}
            value={productId}
          >
            <option value="">Select product...</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="wh">Warehouse</label>
          <select
            className="h-9 w-44 rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
            id="wh"
            onChange={(e) => setWarehouseId(e.target.value)}
            value={warehouseId}
          >
            <option value="">All warehouses</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
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
          disabled={!productId || loading}
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
