"use client";

import { Plus } from "lucide-react";
import { useState, useTransition } from "react";

import { createInventoryAdjustment } from "@/domains/inventory/actions/create-inventory-adjustment";

type ProductOption = {
  id: string;
  sku: string;
  name: string;
};

type WarehouseOption = {
  id: string;
  name: string;
  code: string;
};

type ReasonOption = {
  code: string;
  name: string;
  direction: string | null;
};

export function AdjustmentForm({
  products,
  warehouses,
  reasons,
}: {
  products: ProductOption[];
  warehouses: WarehouseOption[];
  reasons: ReasonOption[];
}) {
  const [isPending, startTransition] = useTransition();
  const [warehouseId, setWarehouseId] = useState("");
  const [productId, setProductId] = useState("");
  const [direction, setDirection] = useState<"IN" | "OUT">("IN");
  const [quantity, setQuantity] = useState("");
  const [reasonCode, setReasonCode] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const filteredReasons = reasons.filter((reason) => !reason.direction || reason.direction === direction);

  function submitAdjustment() {
    setMessage(null);

    startTransition(async () => {
      const result = await createInventoryAdjustment({
        warehouseId,
        productId,
        direction,
        quantity,
        reasonCode,
        notes,
      });

      if (!result.ok) {
        setMessage(result.message ?? "Unable to post adjustment.");
        return;
      }

      setMessage("Adjustment posted.");
      setWarehouseId("");
      setProductId("");
      setQuantity("");
      setReasonCode("");
      setNotes("");
      setDirection("IN");
    });
  }

  const canSubmit = warehouseId && productId && quantity && reasonCode && !isPending;

  return (
    <section className="rounded-lg border p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">New Adjustment</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Select a product, warehouse, direction, and reason to adjust stock.
          </p>
        </div>
        <button
          className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          disabled={!canSubmit}
          type="button"
          onClick={submitAdjustment}
        >
          <Plus className="size-4" />
          {isPending ? "Posting" : "Post Adjustment"}
        </button>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-2 text-sm">
          <span className="font-medium">
            Warehouse <span className="text-destructive">*</span>
          </span>
          <select
            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
            value={warehouseId}
            onChange={(event) => setWarehouseId(event.target.value)}
          >
            <option value="">Select warehouse</option>
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name} ({warehouse.code})
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium">
            Product <span className="text-destructive">*</span>
          </span>
          <select
            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
          >
            <option value="">Select product</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.sku} - {product.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium">
            Direction <span className="text-destructive">*</span>
          </span>
          <select
            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
            value={direction}
            onChange={(event) => {
              setDirection(event.target.value as "IN" | "OUT");
              setReasonCode("");
            }}
          >
            <option value="IN">IN — Add stock</option>
            <option value="OUT">OUT — Remove stock</option>
          </select>
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium">
            Quantity <span className="text-destructive">*</span>
          </span>
          <input
            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
            min="0"
            step="0.001"
            type="number"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
        </label>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm">
          <span className="font-medium">
            Reason <span className="text-destructive">*</span>
          </span>
          <select
            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
            value={reasonCode}
            onChange={(event) => setReasonCode(event.target.value)}
          >
            <option value="">Select reason</option>
            {filteredReasons.map((reason) => (
              <option key={reason.code} value={reason.code}>
                {reason.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium">Notes</span>
          <input
            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>
      </div>

      {message ? (
        <p className="mt-4 text-sm text-muted-foreground">{message}</p>
      ) : null}
    </section>
  );
}
