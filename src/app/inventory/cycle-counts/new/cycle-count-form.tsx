"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

import { createCycleCount } from "@/domains/inventory/actions/create-cycle-count";
import { uid } from "@/lib/uid";

type ProductOption = { id: string; sku: string; name: string };
type WarehouseOption = { id: string; name: string; code: string };

type Line = {
  id: string;
  productId: string;
  expectedQty: string;
  notes: string;
};

function createLine(productId?: string, expectedQty?: string): Line {
  return { id: uid(), productId: productId ?? "", expectedQty: expectedQty ?? "", notes: "" };
}

export function CycleCountForm({
  products,
  warehouses,
  initialBalances,
}: {
  products: ProductOption[];
  warehouses: WarehouseOption[];
  initialBalances: Record<string, Record<string, string>>;
}) {
  const [isPending, startTransition] = useTransition();
  const [warehouseId, setWarehouseId] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([createLine()]);
  const [message, setMessage] = useState<string | null>(null);

  function updateLine(id: string, patch: Partial<Line>) {
    setLines((current) => current.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function removeLine(id: string) {
    setLines((current) => (current.length === 1 ? current : current.filter((l) => l.id !== id)));
  }

  function addLine(productId?: string) {
    const whBalances = initialBalances[warehouseId] ?? {};
    const eqty = productId && whBalances[productId] ? whBalances[productId] : "";
    setLines((current) => [...current, createLine(productId, eqty)]);
  }

  function onWarehouseChange(id: string) {
    setWarehouseId(id);
    const whBalances = initialBalances[id] ?? {};
    setLines((current) =>
      current.map((l) => ({
        ...l,
        expectedQty: l.productId && whBalances[l.productId] ? whBalances[l.productId] : l.expectedQty,
      })),
    );
  }

  function addAllProducts() {
    const whBalances = initialBalances[warehouseId] ?? {};
    const existing = new Set(lines.map((l) => l.productId));
    const toAdd = products.filter((p) => !existing.has(p.id));

    setLines((current) => [
      ...current,
      ...toAdd.map((p) => createLine(p.id, whBalances[p.id] ?? "0.000")),
    ]);
  }

  function submit() {
    setMessage(null);

    startTransition(async () => {
      const result = await createCycleCount({
        warehouseId,
        notes,
        lines: lines.map((l) => ({
          productId: l.productId,
          expectedQty: l.expectedQty || "0",
          notes: l.notes,
        })),
      });

      if (!result.ok) {
        setMessage(result.message ?? "Unable to create cycle count.");
        return;
      }

      window.location.href = `/inventory/cycle-counts/${result.data?.id}`;
    });
  }

  return (
    <section className="rounded-lg border p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">Cycle Count Details</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a new cycle count document. Expected quantities are automatically filled from the current stock balance.
          </p>
        </div>
        <button
          className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          disabled={isPending || !warehouseId || lines.length === 0 || lines.some((l) => !l.productId)}
          type="button"
          onClick={submit}
        >
          <Plus className="size-4" />
          {isPending ? "Creating" : "Create Count"}
        </button>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm">
          <span className="font-medium">
            Warehouse <span className="text-destructive">*</span>
          </span>
          <select
            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
            value={warehouseId}
            onChange={(e) => onWarehouseChange(e.target.value)}
          >
            <option value="">Select warehouse</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.code})
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Notes</span>
          <input
            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
      </div>

      <div className="mt-5 overflow-x-auto rounded-md border">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted/70 text-xs font-semibold uppercase text-muted-foreground">
            <tr className="border-b">
              <th className="h-10 px-3 text-left">Product</th>
              <th className="h-10 w-40 px-3 text-right">Expected Qty</th>
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
                    onChange={(e) => {
                      const whBalances = initialBalances[warehouseId] ?? {};
                      const eqty = whBalances[e.target.value] ?? "";
                      updateLine(line.id, { productId: e.target.value, expectedQty: eqty });
                    }}
                  >
                    <option value="">Select product</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.sku} - {p.name}
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
                    value={line.expectedQty}
                    onChange={(e) => updateLine(line.id, { expectedQty: e.target.value })}
                  />
                </td>
                <td className="p-3">
                  <input
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
                    value={line.notes}
                    onChange={(e) => updateLine(line.id, { notes: e.target.value })}
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
          onClick={() => addLine()}
        >
          <Plus className="size-4" /> Add Line
        </button>
        {warehouseId ? (
          <button
            className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition hover:bg-muted"
            type="button"
            onClick={addAllProducts}
          >
            Add All Products
          </button>
        ) : null}
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </div>
    </section>
  );
}
