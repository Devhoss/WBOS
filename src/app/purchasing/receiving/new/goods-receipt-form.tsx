"use client";

import { Plus } from "lucide-react";
import { useState, useTransition } from "react";

import { BarcodeScanInput } from "@/components/barcode-scan-input";
import { lookupPOLineByBarcode } from "@/domains/purchasing/actions/lookup-po-line-by-barcode";
import { receiveGoods } from "@/domains/purchasing/actions/receive-goods";

type OrderLine = {
  purchaseOrderLineId: string;
  productId: string;
  productName: string;
  productSku: string;
  orderedQuantity: number;
  alreadyReceived: number;
  remaining: number;
};

type OrderOption = {
  id: string;
  poNumber: string;
  supplierName: string;
  lines: OrderLine[];
};

type WarehouseOption = {
  id: string;
  name: string;
  code: string;
};

export function GoodsReceiptForm({
  orders,
  warehouses,
}: {
  orders: OrderOption[];
  warehouses: WarehouseOption[];
}) {
  const [isPending, startTransition] = useTransition();
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [lineNotes, setLineNotes] = useState<Record<string, string>>({});

  const selectedOrder = orders.find((o) => o.id === selectedOrderId);

  function setQuantity(lineId: string, value: string) {
    setQuantities((prev) => ({ ...prev, [lineId]: value }));
  }

  function setLineNote(lineId: string, value: string) {
    setLineNotes((prev) => ({ ...prev, [lineId]: value }));
  }

  function submitReceipt() {
    setMessage(null);

    if (!selectedOrderId || !warehouseId) {
      setMessage("Select a purchase order and warehouse.");
      return;
    }

    const lines = (selectedOrder?.lines ?? [])
      .filter((line) => {
        const qty = Number.parseFloat(quantities[line.purchaseOrderLineId] ?? "");
        return !Number.isNaN(qty) && qty > 0;
      })
      .map((line) => ({
        purchaseOrderLineId: line.purchaseOrderLineId,
        productId: line.productId,
        quantity: quantities[line.purchaseOrderLineId]!,
        notes: lineNotes[line.purchaseOrderLineId] || undefined,
      }));

    if (lines.length === 0) {
      setMessage("Enter at least one line with a quantity.");
      return;
    }

    startTransition(async () => {
      const result = await receiveGoods({
        purchaseOrderId: selectedOrderId,
        warehouseId,
        notes: notes || undefined,
        lines,
      });

      if (!result.ok) {
        setMessage(result.message ?? "Unable to receive goods.");
        return;
      }

      setMessage("Goods receipt posted.");
      setSelectedOrderId("");
      setWarehouseId("");
      setNotes("");
      setQuantities({});
      setLineNotes({});
    });
  }

  return (
    <section className="rounded-lg border p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">New Goods Receipt</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Select a purchase order and enter received quantities for each line.
          </p>
        </div>
        <button
          className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          disabled={isPending || !selectedOrderId || !warehouseId}
          type="button"
          onClick={submitReceipt}
        >
          <Plus className="size-4" />
          {isPending ? "Posting" : "Post Receipt"}
        </button>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <label className="space-y-2 text-sm">
          <span className="font-medium">
            Purchase Order <span className="text-destructive">*</span>
          </span>
          <select
            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
            value={selectedOrderId}
            onChange={(e) => setSelectedOrderId(e.target.value)}
          >
            <option value="">Select order</option>
            {orders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.poNumber} - {o.supplierName}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">
            Warehouse <span className="text-destructive">*</span>
          </span>
          <select
            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
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

      {selectedOrder ? (
        <div className="mt-6 flex items-center gap-3">
          <h3 className="text-sm font-semibold">Items to Receive</h3>
          <BarcodeScanInput
            placeholder="Scan barcode..."
            onScan={async (barcode) => {
              const result = await lookupPOLineByBarcode({ barcode, purchaseOrderId: selectedOrderId });
              if (!result.ok) return result;
              const line = selectedOrder.lines.find((l) => l.purchaseOrderLineId === result.data?.purchaseOrderLineId);
              if (line && result.data?.remaining) {
                setQuantities((prev) => ({ ...prev, [line.purchaseOrderLineId]: String(result.data!.remaining) }));
              }
              return result;
            }}
          />
        </div>
      ) : (
        <div className="mt-6">
          <h3 className="text-sm font-semibold">Items to Receive</h3>
        </div>
      )}
      <p className="mt-1 text-xs text-muted-foreground">
        Enter quantities for items being received. Only items with a quantity greater than zero will be posted.
      </p>

      <div className="mt-3 overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/70 text-xs font-semibold uppercase text-muted-foreground">
            <tr className="border-b">
              <th className="h-10 px-3 text-left">Product</th>
              <th className="h-10 px-3 text-right">Ordered</th>
              <th className="h-10 px-3 text-right">Received</th>
              <th className="h-10 px-3 text-right">Remaining</th>
              <th className="h-10 w-28 px-3 text-right">Receiving Now</th>
              <th className="h-10 px-3 text-left">Notes</th>
            </tr>
          </thead>
          <tbody>
            {!selectedOrder ? (
              <tr>
                <td colSpan={6} className="h-20 text-center text-sm text-muted-foreground">
                  Select a purchase order to see its lines.
                </td>
              </tr>
            ) : selectedOrder.lines.length === 0 ? (
              <tr>
                <td colSpan={6} className="h-20 text-center text-sm text-muted-foreground">
                  No lines found.
                </td>
              </tr>
            ) : (
              selectedOrder.lines.map((line) => (
                <tr key={line.purchaseOrderLineId} className="border-b last:border-b-0 hover:bg-muted/30">
                  <td className="h-10 px-3">
                    <span className="font-medium">{line.productName}</span>
                    <span className="ml-2 font-mono text-xs text-muted-foreground">{line.productSku}</span>
                  </td>
                  <td className="h-10 px-3 text-right font-mono tabular-nums">
                    {line.orderedQuantity.toFixed(3)}
                  </td>
                  <td className="h-10 px-3 text-right font-mono tabular-nums text-muted-foreground">
                    {line.alreadyReceived.toFixed(3)}
                  </td>
                  <td className="h-10 px-3 text-right font-mono tabular-nums">
                    {line.remaining.toFixed(3)}
                  </td>
                  <td className="p-3">
                    <input
                      className="h-10 w-full rounded-md border bg-background px-3 text-right text-sm outline-none focus:border-primary"
                      disabled={line.remaining <= 0}
                      min="0"
                      max={line.remaining}
                      step="0.001"
                      type="number"
                      value={quantities[line.purchaseOrderLineId] ?? ""}
                      onChange={(e) => setQuantity(line.purchaseOrderLineId, e.target.value)}
                    />
                  </td>
                  <td className="p-3">
                    <input
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
                      value={lineNotes[line.purchaseOrderLineId] ?? ""}
                      onChange={(e) => setLineNote(line.purchaseOrderLineId, e.target.value)}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {message ? <p className="mt-4 text-sm text-muted-foreground">{message}</p> : null}
    </section>
  );
}
