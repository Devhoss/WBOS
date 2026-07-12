"use client";

import { Package, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

import { createShipmentAction } from "../../../domains/sales/actions/create-shipment";

type OrderOpt = {
  id: string; soNumber: string; customerName: string;
  lines: Array<{ id: string; productId: string; productName: string; productSku: string; orderedQuantity: number; shippedQuantity: number; unitOfMeasureCode: string }>;
};
type WarehouseOpt = { id: string; name: string; code: string };
type ShipmentLineInput = { salesOrderLineId: string; productId: string; quantity: string; productName: string; productSku: string; unitOfMeasureCode: string; notes: string };
type OrderSelection = { orderId: string; lines: ShipmentLineInput[] } | null;

export function ShipmentLinesForm({ orders, preselectedOrderId, warehouses }: {
  orders: OrderOpt[]; preselectedOrderId?: string; warehouses: WarehouseOpt[];
}) {
  const [isPending, startTransition] = useTransition();
  const [warehouseId, setWarehouseId] = useState(warehouses.find((w) => w)?.id ?? "");
  const [notes, setNotes] = useState("");
  const [selection, setSelection] = useState<OrderSelection>(() => {
    if (!preselectedOrderId) return null;
    const order = orders.find((o) => o.id === preselectedOrderId);
    if (!order) return null;
    return {
      orderId: order.id,
      lines: order.lines.map((l) => ({
        salesOrderLineId: l.id, productId: l.productId, quantity: String(l.orderedQuantity - l.shippedQuantity),
        productName: l.productName, productSku: l.productSku, unitOfMeasureCode: l.unitOfMeasureCode, notes: "",
      })),
    };
  });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedOrder = selection ? orders.find((o) => o.id === selection.orderId) : null;

  function selectOrder(orderId: string) {
    const order = orders.find((o) => o.id === orderId);
    if (!order) { setSelection(null); return; }
    setSelection({
      orderId: order.id,
      lines: order.lines.map((l) => ({
        salesOrderLineId: l.id, productId: l.productId, quantity: String(l.orderedQuantity - l.shippedQuantity),
        productName: l.productName, productSku: l.productSku, unitOfMeasureCode: l.unitOfMeasureCode, notes: "",
      })),
    });
    setError(null);
    setMessage(null);
  }

  function updateLine(solId: string, field: string, value: string) {
    setSelection((prev) => {
      if (!prev) return prev;
      return { ...prev, lines: prev.lines.map((l) => l.salesOrderLineId === solId ? { ...l, [field]: value } : l) };
    });
  }

  function removeLine(solId: string) {
    setSelection((prev) => {
      if (!prev || prev.lines.length <= 1) return prev;
      return { ...prev, lines: prev.lines.filter((l) => l.salesOrderLineId !== solId) };
    });
  }

  function create() {
    if (!selection) { setError("Please select a sales order."); return; }
    if (!warehouseId) { setError("Please select a warehouse."); return; }

    const validLines = selection.lines.filter((l) => Number.parseFloat(l.quantity) > 0);
    if (validLines.length === 0) { setError("At least one line must have a quantity greater than zero."); return; }

    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await createShipmentAction({
        salesOrderId: selection.orderId,
        warehouseId,
        notes: notes || undefined,
        lines: validLines.map((l) => ({
          salesOrderLineId: l.salesOrderLineId,
          productId: l.productId,
          quantity: l.quantity,
          productName: l.productName,
          productSku: l.productSku,
          notes: l.notes || undefined,
        })),
      });
      if (!result.ok) { setError(result.message ?? "Unable to create shipment."); return; }
      window.location.href = `/sales/shipments/${result.data?.id}`;
    });
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Package className="size-10 text-muted-foreground" />
        <p className="mt-3 text-sm font-medium">No orders available for shipment.</p>
        <p className="mt-1 text-xs text-muted-foreground">All approved orders have been fully shipped.</p>
      </div>
    );
  }

  return (
    <section className="rounded-lg border p-5">
      <h2 className="text-sm font-semibold">1. Select Sales Order</h2>
      <div className="mt-3">
        <label className="sr-only">Sales Order</label>
        <select className="h-10 w-full max-w-md rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
          value={selection?.orderId ?? ""} onChange={(e) => selectOrder(e.target.value)}>
          <option value="" disabled>Choose an order...</option>
          {orders.map((o) => (<option key={o.id} value={o.id}>{o.soNumber} - {o.customerName} ({o.lines.length} line(s))</option>))}
        </select>
      </div>

      <h2 className="mt-6 text-sm font-semibold">2. Warehouse</h2>
      <div className="mt-3">
        <label className="sr-only">Warehouse</label>
        <select className="h-10 w-full max-w-md rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
          value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
          <option value="" disabled>Select warehouse...</option>
          {warehouses.map((w) => (<option key={w.id} value={w.id}>{w.name} ({w.code})</option>))}
        </select>
      </div>

      {selectedOrder ? (
        <>
          <h2 className="mt-6 text-sm font-semibold">3. Shipment Lines</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Quantities pre-filled to the outstanding amount. Adjust if shipping partially.
          </p>
          <div className="mt-3 overflow-x-auto rounded-md border">
            <table className="w-full min-w-[600px] text-sm">
              <thead className="bg-muted/70 text-xs font-semibold uppercase text-muted-foreground">
                <tr className="border-b">
                  <th className="h-10 px-3 text-left">Product</th><th className="h-10 px-3 text-left">UOM</th>
                  <th className="h-10 px-3 text-right">Outstanding</th><th className="h-10 w-28 px-3 text-right">Ship Qty</th>
                  <th className="h-10 px-3 text-left">Notes</th>
                  <th className="h-10 w-12 px-3 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {selection!.lines.map((l) => {
                  const sol = selectedOrder.lines.find((ol) => ol.id === l.salesOrderLineId);
                  const outstanding = sol ? sol.orderedQuantity - sol.shippedQuantity : 0;
                  return (
                    <tr key={l.salesOrderLineId} className="border-b last:border-b-0 hover:bg-muted/30">
                      <td className="h-12 px-3"><span className="font-medium">{l.productName}</span><span className="ml-2 font-mono text-xs text-muted-foreground">{l.productSku}</span></td>
                      <td className="h-12 px-3 text-muted-foreground">{sol ? sol.unitOfMeasureCode : l.unitOfMeasureCode || "-"}</td>
                      <td className="h-12 px-3 text-right font-mono tabular-nums text-muted-foreground">{outstanding.toFixed(3)}</td>
                      <td className="h-12 px-3"><input className="h-10 w-full rounded-md border bg-background px-3 text-right text-sm outline-none focus:border-primary" min="0" max={outstanding} step="0.001" type="number" value={l.quantity} onChange={(e) => updateLine(l.salesOrderLineId, "quantity", e.target.value)} /></td>
                      <td className="h-12 px-3"><input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary" value={l.notes} onChange={(e) => updateLine(l.salesOrderLineId, "notes", e.target.value)} /></td>
                      <td className="h-12 px-3 text-right">
                        <button className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40" disabled={selection!.lines.length === 1} type="button" onClick={() => removeLine(l.salesOrderLineId)}>
                          <Trash2 className="size-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-6 rounded-lg border bg-muted/20 p-4">
            <h3 className="text-sm font-semibold">Shipment Summary</h3>
            <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <div className="flex gap-2">
                <dt className="text-muted-foreground shrink-0">Customer:</dt>
                <dd className="font-medium">{selectedOrder.customerName}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-muted-foreground shrink-0">Warehouse:</dt>
                <dd className="font-medium">{warehouses.find((w) => w.id === warehouseId)?.name ?? "Not selected"}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-muted-foreground shrink-0">Products:</dt>
                <dd className="font-medium">{selection!.lines.filter((l) => Number.parseFloat(l.quantity) > 0).length} line(s)</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-muted-foreground shrink-0">Total Qty:</dt>
                <dd className="font-medium">
                  {selection!.lines.reduce((s, l) => s + (Number.parseFloat(l.quantity) || 0), 0).toFixed(3)}
                </dd>
              </div>
            </dl>
            {notes ? <p className="mt-2 text-xs text-muted-foreground">Notes: {notes}</p> : null}
          </div>

          <div className="mt-4 space-y-3">
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Shipment Notes</span>
              <input className="h-10 w-full max-w-lg rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
                value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes..." />
            </label>

            <div className="flex items-center gap-3">
              <button className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
                disabled={isPending || selection!.lines.every((l) => Number.parseFloat(l.quantity) <= 0)} type="button" onClick={create}>
                <Package className="size-4" />{isPending ? "Creating..." : "Create Shipment"}
              </button>
              {error ? <p className="text-sm text-red-500">{error}</p> : null}
              {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
