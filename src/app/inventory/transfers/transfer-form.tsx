"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

import { createWarehouseTransfer } from "@/domains/inventory/actions/create-warehouse-transfer";
import { uid } from "@/lib/uid";

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

type TransferLine = {
  id: string;
  productId: string;
  quantity: string;
  notes: string;
};

function createLine(): TransferLine {
  return {
    id: uid(),
    productId: "",
    quantity: "",
    notes: "",
  };
}

export function TransferForm({
  products,
  warehouses,
}: {
  products: ProductOption[];
  warehouses: WarehouseOption[];
}) {
  const [isPending, startTransition] = useTransition();
  const [lines, setLines] = useState<TransferLine[]>([createLine()]);
  const [sourceWarehouseId, setSourceWarehouseId] = useState("");
  const [destinationWarehouseId, setDestinationWarehouseId] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const warehouseOptions = warehouses.filter((w) => w.id !== sourceWarehouseId);

  function updateLine(id: string, patch: Partial<TransferLine>) {
    setLines((current) => current.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  }

  function removeLine(id: string) {
    setLines((current) => (current.length === 1 ? current : current.filter((line) => line.id !== id)));
  }

  function submitTransfer() {
    setMessage(null);

    startTransition(async () => {
      const result = await createWarehouseTransfer({
        sourceWarehouseId,
        destinationWarehouseId,
        notes,
        lines: lines.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          notes: line.notes,
        })),
      });

      if (!result.ok) {
        setMessage(result.message ?? "Unable to post warehouse transfer.");
        return;
      }

      setMessage("Warehouse transfer posted.");
      setSourceWarehouseId("");
      setDestinationWarehouseId("");
      setNotes("");
      setLines([createLine()]);
    });
  }

  return (
    <section className="rounded-lg border p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">New Warehouse Transfer</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Move stock from one warehouse to another. Each transfer generates a Warehouse Transfer (WT) document number.
          </p>
        </div>
        <button
          className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          disabled={isPending || !sourceWarehouseId || !destinationWarehouseId || lines.length === 0}
          type="button"
          onClick={submitTransfer}
        >
          <Plus className="size-4" />
          {isPending ? "Posting" : "Post Transfer"}
        </button>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="space-y-2 text-sm">
          <span className="font-medium">
            Source Warehouse <span className="text-destructive">*</span>
          </span>
          <select
            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
            value={sourceWarehouseId}
            onChange={(event) => {
              setSourceWarehouseId(event.target.value);
              if (destinationWarehouseId === event.target.value) {
                setDestinationWarehouseId("");
              }
            }}
          >
            <option value="">Select source</option>
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name} ({warehouse.code})
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium">
            Destination Warehouse <span className="text-destructive">*</span>
          </span>
          <select
            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
            value={destinationWarehouseId}
            onChange={(event) => setDestinationWarehouseId(event.target.value)}
          >
            <option value="">Select destination</option>
            {warehouseOptions.map((warehouse) => (
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
        <table className="w-full min-w-[640px] text-sm">
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
