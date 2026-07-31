"use client";

import { useState, useEffect } from "react";

import { ReportLayout } from "../../components/report-layout";
import { ReportTable } from "../../components/report-table";
import { ExportButton } from "../../components/export-button";
import { PrintButton } from "../../components/print-button";
import { getProductCostCard } from "@/domains/reports/services/report-actions";
import type { ReportColumn } from "@/domains/reports/dto/report-types";

const headerColumns: ReportColumn[] = [
  { key: "productName", label: "Product" },
  { key: "productSku", label: "SKU" },
  { key: "warehouseName", label: "Warehouse" },
  { key: "averageCost", label: "Avg Cost", align: "right", format: "currency" },
  { key: "totalQuantity", label: "On Hand", align: "right", format: "number" },
  { key: "totalValue", label: "Total Value", align: "right", format: "currency" },
];

const detailColumns: ReportColumn[] = [
  { key: "occurredAt", label: "Date", format: "date" },
  { key: "documentNumber", label: "Document" },
  { key: "movementType", label: "Movement Type" },
  { key: "direction", label: "Dir" },
  { key: "quantity", label: "Qty", align: "right", format: "number" },
  { key: "unitCost", label: "Unit Cost", align: "right", format: "currency" },
  { key: "totalCost", label: "Total Cost", align: "right", format: "currency" },
  { key: "runningQuantity", label: "Run Qty", align: "right", format: "number" },
  { key: "runningValue", label: "Run Value", align: "right", format: "currency" },
  { key: "runningAvg", label: "Run Avg", align: "right", format: "currency" },
];

type ProductOption = { id: string; name: string; sku: string };
type WarehouseOption = { id: string; name: string };

export function CostCardClient() {
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [productId, setProductId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [header, setHeader] = useState<Record<string, unknown> | null>(null);
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
    if (!productId || !warehouseId) return;
    setLoading(true);
    try {
      const result = await getProductCostCard(productId, warehouseId) as unknown as { header: Record<string, unknown>; entries: Record<string, unknown>[] };
      setHeader(result.header);
      setData(result.entries);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ReportLayout
      title="Product Cost Card"
      description="Full cost audit trail with running average for a product in a specific warehouse"
      actions={
        <div className="no-print flex gap-2">
          <ExportButton data={data} columns={detailColumns} filename="product-cost-card" />
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
            <option value="">Select warehouse...</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>
        <button
          className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          disabled={!productId || !warehouseId || loading}
          onClick={handleGenerate}
          type="button"
        >
          {loading ? "Loading..." : "Generate"}
        </button>
      </div>

      {header ? (
        <div className="mt-4 rounded-lg border bg-card">
          <div className="px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">Summary</h3>
          </div>
          <ReportTable columns={headerColumns} rows={[header]} />
        </div>
      ) : null}

      <div className="mt-4">
        <h3 className="mb-2 text-sm font-semibold text-foreground">Transaction Detail</h3>
        <ReportTable columns={detailColumns} rows={data} />
      </div>
    </ReportLayout>
  );
}
