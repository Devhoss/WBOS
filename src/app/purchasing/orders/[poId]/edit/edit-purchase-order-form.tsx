"use client";

import { Plus, Save, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

import { updatePurchaseOrder } from "../../../../../domains/purchasing/actions/update-purchase-order";
import { uid } from "@/lib/uid";

type ProductOption = {
  id: string;
  sku: string;
  name: string;
};

type SupplierOption = {
  id: string;
  name: string;
};

type UnitOption = {
  id: string;
  name: string;
  code: string;
};

type OrderData = {
  id: string;
  poNumber: string;
  supplierId: string;
  currency: string;
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
  expectedDeliveryDate: string;
  deliveryAddress: string;
  notes: string;
  internalNotes: string;
  lines: Array<{
    id: string;
    productId: string;
    unitOfMeasureId: string;
    orderedQuantity: string;
    unitCost: string;
    totalCost: string;
    description: string;
    notes: string;
  }>;
};

type EditLine = {
  id: string;
  productId: string;
  unitOfMeasureId: string;
  orderedQuantity: string;
  unitCost: string;
  totalCost: string;
  description: string;
  notes: string;
};

function calcTotal(quantity: string, unitCost: string): string {
  const q = Number.parseFloat(quantity);
  const c = Number.parseFloat(unitCost);
  if (Number.isNaN(q) || Number.isNaN(c)) return "";
  return (q * c).toFixed(3);
}

export function EditPurchaseOrderForm({
  order,
  products,
  suppliers,
  units,
}: {
  order: OrderData;
  products: ProductOption[];
  suppliers: SupplierOption[];
  units: UnitOption[];
}) {
  const [isPending, startTransition] = useTransition();
  const [lines, setLines] = useState<EditLine[]>(order.lines);
  const [message, setMessage] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState(order.supplierId);
  const [currency, setCurrency] = useState(order.currency);
  const [taxAmount] = useState(order.taxAmount);
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(order.expectedDeliveryDate);
  const [deliveryAddress, setDeliveryAddress] = useState(order.deliveryAddress);
  const [notes, setNotes] = useState(order.notes);
  const [internalNotes, setInternalNotes] = useState(order.internalNotes);

  function updateLine(id: string, patch: Partial<EditLine>) {
    setLines((current) =>
      current.map((line) => {
        if (line.id !== id) return line;
        const updated = { ...line, ...patch };
        if ("orderedQuantity" in patch || "unitCost" in patch) {
          updated.totalCost = calcTotal(updated.orderedQuantity, updated.unitCost);
        }
        return updated;
      }),
    );
  }

  function removeLine(id: string) {
    setLines((current) => (current.length === 1 ? current : current.filter((line) => line.id !== id)));
  }

  function saveOrder() {
    setMessage(null);

    startTransition(async () => {
      const subtotal = lines.reduce((sum, line) => {
        const tc = Number.parseFloat(line.totalCost);
        return sum + (Number.isNaN(tc) ? 0 : tc);
      }, 0);
      const tax = Number.parseFloat(taxAmount) || 0;
      const total = subtotal + tax;

      const result = await updatePurchaseOrder({
        id: order.id,
        supplierId,
        currency,
        subtotal: subtotal.toFixed(3),
        taxAmount,
        totalAmount: total.toFixed(3),
        expectedDeliveryDate: expectedDeliveryDate || undefined,
        deliveryAddress: deliveryAddress || undefined,
        notes: notes || undefined,
        internalNotes: internalNotes || undefined,
        lines: lines.map((line) => ({
          productId: line.productId,
          unitOfMeasureId: line.unitOfMeasureId,
          orderedQuantity: line.orderedQuantity,
          unitCost: line.unitCost,
          totalCost: line.totalCost,
          description: line.description || undefined,
          notes: line.notes || undefined,
        })),
      });

      if (!result.ok) {
        setMessage(result.message ?? "Unable to update purchase order.");
        return;
      }

      setMessage("Purchase order updated.");
    });
  }

  return (
    <section className="rounded-lg border p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">Order Details</h2>
          <p className="mt-1 text-sm text-muted-foreground">{order.poNumber}</p>
        </div>
        <button
          className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          disabled={isPending}
          type="button"
          onClick={saveOrder}
        >
          <Save className="size-4" />
          {isPending ? "Saving..." : "Save Changes"}
        </button>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <label className="space-y-2 text-sm">
          <span className="font-medium">Supplier</span>
          <select
            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
          >
            <option value="">Select supplier</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Currency</span>
          <select
            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            <option value="KWD">KWD</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Expected Delivery</span>
          <input
            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
            type="date"
            value={expectedDeliveryDate}
            onChange={(e) => setExpectedDeliveryDate(e.target.value)}
          />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Delivery Address</span>
          <input
            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
            value={deliveryAddress}
            onChange={(e) => setDeliveryAddress(e.target.value)}
          />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Notes</span>
          <input
            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Internal Notes</span>
          <input
            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
            value={internalNotes}
            onChange={(e) => setInternalNotes(e.target.value)}
          />
        </label>
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-semibold">Line Items</h3>
      </div>

      <div className="mt-3 overflow-x-auto rounded-md border">
        <table className="w-full min-w-[960px] text-sm">
          <thead className="bg-muted/70 text-xs font-semibold uppercase text-muted-foreground">
            <tr className="border-b">
              <th className="h-10 px-3 text-left">Product</th>
              <th className="h-10 px-3 text-left">UOM</th>
              <th className="h-10 w-28 px-3 text-right">Qty</th>
              <th className="h-10 w-28 px-3 text-right">Unit Cost</th>
              <th className="h-10 w-28 px-3 text-right">Total</th>
              <th className="h-10 px-3 text-left">Description</th>
              <th className="h-10 px-3 text-left">Notes</th>
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
                    onChange={(e) => updateLine(line.id, { productId: e.target.value })}
                  >
                    <option value="">Select product</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.sku} - {p.name}</option>
                    ))}
                  </select>
                </td>
                <td className="p-3">
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
                    value={line.unitOfMeasureId}
                    onChange={(e) => updateLine(line.id, { unitOfMeasureId: e.target.value })}
                  >
                    <option value="">Select UOM</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>{u.code}</option>
                    ))}
                  </select>
                </td>
                <td className="p-3">
                  <input
                    className="h-10 w-full rounded-md border bg-background px-3 text-right text-sm outline-none focus:border-primary"
                    min="0"
                    step="0.001"
                    type="number"
                    value={line.orderedQuantity}
                    onChange={(e) => updateLine(line.id, { orderedQuantity: e.target.value })}
                  />
                </td>
                <td className="p-3">
                  <input
                    className="h-10 w-full rounded-md border bg-background px-3 text-right text-sm outline-none focus:border-primary"
                    min="0"
                    step="0.001"
                    type="number"
                    value={line.unitCost}
                    onChange={(e) => updateLine(line.id, { unitCost: e.target.value })}
                  />
                </td>
                <td className="p-3">
                  <input
                    className="h-10 w-full rounded-md border bg-background px-3 text-right text-sm outline-none focus:border-primary"
                    readOnly
                    type="text"
                    value={line.totalCost}
                  />
                </td>
                <td className="p-3">
                  <input
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
                    value={line.description}
                    onChange={(e) => updateLine(line.id, { description: e.target.value })}
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
          onClick={() =>
            setLines((current) => [
              ...current,
              {
                id: uid(),
                productId: "",
                unitOfMeasureId: "",
                orderedQuantity: "",
                unitCost: "",
                totalCost: "",
                description: "",
                notes: "",
              },
            ])
          }
        >
          <Plus className="size-4" />
          Add Line
        </button>
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </div>
    </section>
  );
}
