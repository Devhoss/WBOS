"use client";

import { Plus, Save, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

import { updateSalesOrderAction } from "../../../../../domains/sales/actions/update-sales-order";
import { uid } from "@/lib/uid";

type ProductOpt = { id: string; sku: string; name: string; defaultSellingPrice: number; unitOfMeasureId: string; unitOfMeasureCode: string };
type CustomerOpt = { id: string; name: string; code: string | null };
type UnitOpt = { id: string; name: string; code: string };

type OrderLine = {
  id: string; productId: string; unitOfMeasureId: string; orderedQuantity: string;
  unitPrice: string; totalPrice: string; productName: string; productSku: string;
  unitOfMeasureCode: string; piecesPerBox: string; description: string; notes: string;
};

type OrderData = {
  id: string; soNumber: string; customerId: string; currency: string;
  subtotal: string; taxAmount: string; totalAmount: string; discountAmount: string;
  discountType: string | null; discountRate: string | null;
  expectedShipDate: string; deliveryAddress: string; notes: string; internalNotes: string; customerReference: string;
  lines: OrderLine[];
};

function calcTotal(q: string, p: string): string {
  const qty = Number.parseFloat(q); const prc = Number.parseFloat(p);
  if (Number.isNaN(qty) || Number.isNaN(prc)) return "";
  return (qty * prc).toFixed(3);
}

export function EditSalesOrderForm({ order, products, customers, units }: {
  order: OrderData; products: ProductOpt[]; customers: CustomerOpt[]; units: UnitOpt[];
}) {
  const [isPending, startTransition] = useTransition();
  const [lines, setLines] = useState(order.lines);
  const [message, setMessage] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState(order.customerId);
  const [currency, setCurrency] = useState(order.currency);
  const [taxAmount, setTaxAmount] = useState(order.taxAmount);
  const [expectedShipDate, setExpectedShipDate] = useState(order.expectedShipDate);
  const [deliveryAddress, setDeliveryAddress] = useState(order.deliveryAddress);
  const [notes, setNotes] = useState(order.notes);
  const [internalNotes, setInternalNotes] = useState(order.internalNotes);
  const [customerReference, setCustomerReference] = useState(order.customerReference);
  const [discountType, setDiscountType] = useState<"" | "PERCENTAGE" | "FIXED">((order.discountType as "" | "PERCENTAGE" | "FIXED") ?? "");
  const [discountRate, setDiscountRate] = useState(order.discountRate ?? "");

  function updateLine(id: string, patch: Partial<typeof lines[0]>) {
    setLines((current) => current.map((line) => {
      if (line.id !== id) return line;
      const updated = { ...line, ...patch };
      if ("productId" in patch && patch.productId) {
        const p = products.find((pr) => pr.id === patch.productId);
        if (p) { updated.productName = p.name; updated.productSku = p.sku; updated.unitOfMeasureId = p.unitOfMeasureId; updated.unitOfMeasureCode = p.unitOfMeasureCode; }
      }
      if ("orderedQuantity" in patch || "unitPrice" in patch) updated.totalPrice = calcTotal(updated.orderedQuantity, updated.unitPrice);
      return updated;
    }));
  }

  function removeLine(id: string) { setLines((current) => (current.length === 1 ? current : current.filter((l) => l.id !== id))); }

  function saveOrder() {
    setMessage(null);
    const subtotal = lines.reduce((s, l) => s + (Number.parseFloat(l.totalPrice) || 0), 0);
    const tax = Number.parseFloat(taxAmount) || 0;
    let discountAmount = 0;
    if (discountType === "FIXED" && discountRate) {
      discountAmount = Number.parseFloat(discountRate) || 0;
    } else if (discountType === "PERCENTAGE" && discountRate) {
      discountAmount = subtotal * ((Number.parseFloat(discountRate) || 0) / 100);
    }
    const total = subtotal + tax - discountAmount;
    startTransition(async () => {
      const result = await updateSalesOrderAction({
        id: order.id, customerId, currency, subtotal: subtotal.toFixed(3), taxAmount,
        totalAmount: total.toFixed(3),
        discountAmount: discountAmount.toFixed(3),
        discountType: discountType || undefined,
        discountRate: discountRate || undefined,
        expectedShipDate: expectedShipDate || undefined, deliveryAddress: deliveryAddress || undefined,
        notes: notes || undefined, internalNotes: internalNotes || undefined, customerReference: customerReference || undefined,
        lines: lines.map((l) => ({
          productId: l.productId, unitOfMeasureId: l.unitOfMeasureId, orderedQuantity: l.orderedQuantity,
          unitPrice: l.unitPrice, totalPrice: l.totalPrice, productName: l.productName, productSku: l.productSku,
          unitOfMeasureCode: l.unitOfMeasureCode, piecesPerBox: l.piecesPerBox || undefined,
          description: l.description || undefined, notes: l.notes || undefined,
        })),
      });
      if (!result.ok) { setMessage(result.message ?? "Unable to update."); return; }
      setMessage("Sales order updated.");
    });
  }

  return (
    <section className="rounded-lg border p-5">
      <div className="flex justify-between">
        <div><h2 className="text-base font-semibold">Order Details</h2><p className="mt-1 text-sm text-muted-foreground">{order.soNumber}</p></div>
        <button className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          disabled={isPending} type="button" onClick={saveOrder}>
          <Save className="size-4" />{isPending ? "Saving..." : "Save Changes"}
        </button>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <label className="space-y-2 text-sm">
          <span className="font-medium">Customer</span>
          <select className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
            value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            {customers.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </select>
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Currency</span>
          <select className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
            value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <option value="KWD">KWD</option><option value="USD">USD</option><option value="EUR">EUR</option>
          </select>
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Expected Ship</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
            type="date" value={expectedShipDate} onChange={(e) => setExpectedShipDate(e.target.value)} />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Delivery Address</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
            value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Customer Reference</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
            value={customerReference} onChange={(e) => setCustomerReference(e.target.value)} />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Notes</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
            value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Internal Notes</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
            value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} />
        </label>
      </div>

      <div className="mt-6"><h3 className="text-sm font-semibold">Line Items</h3></div>
      <div className="mt-3 overflow-x-auto rounded-md border">
        <table className="w-full min-w-[1040px] text-sm">
          <thead className="bg-muted/70 text-xs font-semibold uppercase text-muted-foreground">
            <tr className="border-b">
              <th className="h-10 px-3 text-left">Product</th><th className="h-10 px-3 text-left">UOM</th>
              <th className="h-10 w-28 px-3 text-right">Qty</th><th className="h-10 w-20 px-3 text-right">PC/شد</th>
              <th className="h-10 w-28 px-3 text-right">Unit Price</th>
              <th className="h-10 w-28 px-3 text-right">Total</th><th className="h-10 px-3 text-left">Desc</th>
              <th className="h-10 px-3 text-left">Notes</th><th className="h-10 w-12 px-3 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.id} className="border-b last:border-b-0">
                <td className="p-3">
                  <select className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
                    value={line.productId} onChange={(e) => updateLine(line.id, { productId: e.target.value })}>
                    {products.map((p) => (<option key={p.id} value={p.id}>{p.sku} - {p.name}</option>))}
                  </select>
                </td>
                <td className="p-3">
                  <select className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
                    value={line.unitOfMeasureId} onChange={(e) => updateLine(line.id, { unitOfMeasureId: e.target.value })}>
                    {units.map((u) => (<option key={u.id} value={u.id}>{u.code}</option>))}
                  </select>
                </td>
                <td className="p-3"><input className="h-10 w-full rounded-md border bg-background px-3 text-right text-sm outline-none focus:border-primary" min="0" step="0.001" type="number" value={line.orderedQuantity} onChange={(e) => updateLine(line.id, { orderedQuantity: e.target.value })} /></td>
                <td className="p-3"><input className="h-10 w-full rounded-md border bg-background px-3 text-right text-sm outline-none focus:border-primary" min="0" step="1" type="number" value={line.piecesPerBox} onChange={(e) => updateLine(line.id, { piecesPerBox: e.target.value })} /></td>
                <td className="p-3"><input className="h-10 w-full rounded-md border bg-background px-3 text-right text-sm outline-none focus:border-primary" min="0" step="0.001" type="number" value={line.unitPrice} onChange={(e) => updateLine(line.id, { unitPrice: e.target.value })} /></td>
                <td className="p-3"><input className="h-10 w-full rounded-md border bg-background px-3 text-right text-sm outline-none focus:border-primary" readOnly type="text" value={line.totalPrice} /></td>
                <td className="p-3"><input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary" value={line.description} onChange={(e) => updateLine(line.id, { description: e.target.value })} /></td>
                <td className="p-3"><input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary" value={line.notes} onChange={(e) => updateLine(line.id, { notes: e.target.value })} /></td>
                <td className="p-3 text-right">
                  <button className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40" disabled={lines.length === 1} type="button" onClick={() => removeLine(line.id)}>
                    <Trash2 className="size-4" /><span className="sr-only">Remove</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition hover:bg-muted" type="button"
          onClick={() => setLines((c) => [...c, { id: uid(), productId: "", unitOfMeasureId: "", orderedQuantity: "", unitPrice: "", totalPrice: "", productName: "", productSku: "", unitOfMeasureCode: "", piecesPerBox: "", description: "", notes: "" }])}>
          <Plus className="size-4" />Add Line
        </button>
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </div>

      <div className="mt-4 border-t pt-4">
        <div className="ml-auto flex w-full max-w-xs flex-col gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-mono tabular-nums">
              {lines.reduce((s, l) => s + (Number.parseFloat(l.totalPrice) || 0), 0).toFixed(3)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Discount</span>
            <div className="flex items-center gap-1">
              <select className="h-8 w-24 rounded-md border bg-background px-2 text-sm outline-none focus:border-primary"
                value={discountType} onChange={(e) => setDiscountType(e.target.value as "" | "PERCENTAGE" | "FIXED")}>
                <option value="">None</option>
                <option value="FIXED">FIXED</option>
                <option value="PERCENTAGE">%</option>
              </select>
              <input className="h-8 w-24 rounded-md border bg-background px-2 text-right text-sm outline-none focus:border-primary"
                min="0" step="0.001" type="number" value={discountRate} onChange={(e) => setDiscountRate(e.target.value)}
                disabled={!discountType} />
            </div>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Tax</span>
            <input className="h-8 w-28 rounded-md border bg-background px-2 text-right text-sm outline-none focus:border-primary"
              min="0" step="0.001" type="number" value={taxAmount} onChange={(e) => setTaxAmount(e.target.value)} />
          </div>
          <div className="flex justify-between border-t pt-2 font-semibold">
            <span>Total</span>
            <span className="font-mono tabular-nums">
              {(() => {
                const sub = lines.reduce((s, l) => s + (Number.parseFloat(l.totalPrice) || 0), 0);
                const tax = Number.parseFloat(taxAmount) || 0;
                let disc = 0;
                if (discountType === "FIXED" && discountRate) disc = Number.parseFloat(discountRate) || 0;
                else if (discountType === "PERCENTAGE" && discountRate) disc = sub * ((Number.parseFloat(discountRate) || 0) / 100);
                return (sub + tax - disc).toFixed(3);
              })()}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
