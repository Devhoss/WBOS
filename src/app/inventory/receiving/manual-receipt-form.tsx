"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

import { createManualReceipt } from "../../../domains/inventory/actions/create-manual-receipt";

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

type ReceiptLine = {
  id: string;
  productId: string;
  quantity: string;
  notes: string;
};

function createLine(): ReceiptLine {
  return {
    id: crypto.randomUUID(),
    productId: "",
    quantity: "",
    notes: "",
  };
}

export function ManualReceiptForm({
  products,
  warehouses,
}: {
  products: ProductOption[];
  warehouses: WarehouseOption[];
}) {
  const [isPending, startTransition] = useTransition();
  const [lines, setLines] = useState<ReceiptLine[]>([createLine()]);
  const [message, setMessage] = useState<string | null>(null);
  const [warehouseId, setWarehouseId] = useState("");
  const [notes, setNotes] = useState("");

  function updateLine(id: string, patch: Partial<ReceiptLine>) {
    setLines((current) => current.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  }

  function removeLine(id: string) {
    setLines((current) => (current.length === 1 ? current : current.filter((line) => line.id !== id)));
  }

  function submitReceipt() {
    setMessage(null);

    startTransition(async () => {
      const result = await createManualReceipt({
        warehouseId,
        notes,
        lines: lines.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          notes: line.notes,
        })),
      });

      if (!result.ok) {
        setMessage(result.message ?? "Unable to post manual receipt.");
        return;
      }

      setMessage("Manual receipt posted.");
      setWarehouseId("");
      setNotes("");
      setLines([createLine()]);
    });
  }

  return (
    <section className="rounded-lg border p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">Manual Receiving</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Add stock into a warehouse before purchase orders are introduced.
          </p>
        </div>
        <button
          className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          disabled={isPending}
          type="button"
          onClick={submitReceipt}
        >
          <Plus className="size-4" />
          {isPending ? "Posting" : "Post Receipt"}
        </button>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,320px)_1fr]">
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
          <span className="font-medium">Notes</span>
          <input
            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>
      </div>

      <div className="mt-5 overflow-x-auto rounded-md border">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-muted/70 text-xs font-semibold uppercase text-muted-foreground">
            <tr className="border-b">
              <th className="h-10 px-3 text-left">Product</th>
              <th className="h-10 w-40 px-3 text-right">Quantity</th>
              <th className="h-10 px-3 text-left">Line Notes</th>
              <th className="h-10 w-12 px-3 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.id} className="border-b last:border-b-0">
                <td className="p-3">
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
                    value={line.productId}
                    onChange={(event) => updateLine(line.id, { productId: event.target.value })}
                  >
                    <option value="">Select product</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.sku} - {product.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-3">
                  <input
                    className="h-10 w-full rounded-md border bg-background px-3 text-right text-sm outline-none focus:border-primary"
                    min="0"
                    step="0.001"
                    type="number"
                    value={line.quantity}
                    onChange={(event) => updateLine(line.id, { quantity: event.target.value })}
                  />
                </td>
                <td className="p-3">
                  <input
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
                    value={line.notes}
                    onChange={(event) => updateLine(line.id, { notes: event.target.value })}
                  />
                </td>
                <td className="p-3 text-right">
                  <button
                    className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
                    disabled={lines.length === 1}
                    type="button"
                    onClick={() => removeLine(line.id)}
                  >
                    <Trash2 className="size-4" />
                    <span className="sr-only">Remove line</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition hover:bg-muted"
          type="button"
          onClick={() => setLines((current) => [...current, createLine()])}
        >
          <Plus className="size-4" />
          Add Line
        </button>
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </div>
    </section>
  );
}
