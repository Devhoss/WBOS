"use client";

import { CheckCircle, RotateCcw, XCircle } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { receiveReturnAction } from "@/domains/returns/actions/receive-return";
import { completeReturnAction } from "@/domains/returns/actions/complete-return";
import { cancelReturnAction } from "@/domains/returns/actions/cancel-return";

type LineData = {
  id: string;
  lineNumber: number;
  product: { id: string; name: string; sku: string } | null;
  productId: string;
  expectedQuantity: number;
  receivedQuantity: number;
  disposition: string | null;
  condition: string | null;
};

type ReturnOrderData = {
  id: string;
  returnNumber: string;
  status: string;
  lines: LineData[];
};

type WarehouseOption = { id: string; name: string; code: string };

export function ReturnActions({
  returnOrder: ro, warehouses, defaultWarehouseId,
}: {
  returnOrder: ReturnOrderData; warehouses: WarehouseOption[]; defaultWarehouseId: string;
}) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [warehouseId, setWarehouseId] = useState(defaultWarehouseId);
  const [receivedLines, setReceivedLines] = useState<Record<string, { qty: string; condition: string }>>({});

  const staleStatusErrors = [
    "Only open returns can receive goods.",
    "Only received returns can be completed.",
  ];

  function handleStaleError(result: { ok: boolean; message?: string | null }): boolean {
    if (!result.ok && result.message && staleStatusErrors.includes(result.message)) {
      window.location.reload();
      return true;
    }
    return false;
  }

  async function handleReceive() {
    const lines = ro.lines.map((l) => ({
      lineId: l.id,
      receivedQuantity: Number.parseFloat(receivedLines[l.id]?.qty ?? String(l.expectedQuantity)),
      condition: receivedLines[l.id]?.condition || undefined,
    }));

    setFeedback(null);
    setIsPending(true);
    try {
      const result = await receiveReturnAction({ id: ro.id, lines });
      if (!result.ok) { if (handleStaleError(result)) return; setFeedback(result.message ?? null); setIsPending(false); return; }
      setIsPending(false);
      window.location.reload();
    } catch {
      setFeedback("An unexpected error occurred. Please try again.");
      setIsPending(false);
    }
  }

  async function handleComplete() {
    if (!warehouseId) { setFeedback("Please select a warehouse."); return; }

    const lines = ro.lines.map((l) => ({
      lineId: l.id,
      disposition: ((l as Record<string, unknown>)._disposition as string) || "RESTOCK",
      condition: ((l as Record<string, unknown>)._condition as string) || undefined,
    }));

    setFeedback(null);
    setIsPending(true);
    try {
      const result = await completeReturnAction({ id: ro.id, warehouseId, lines });
      if (!result.ok) { if (handleStaleError(result)) return; setFeedback(result.message ?? null); setIsPending(false); return; }
      setIsPending(false);
      window.location.reload();
    } catch {
      setFeedback("An unexpected error occurred. Please try again.");
      setIsPending(false);
    }
  }

  async function handleCancel() {
    if (!window.confirm("Cancel this return?")) return;
    setFeedback(null);
    setIsPending(true);
    try {
      const result = await cancelReturnAction(ro.id);
      if (!result.ok) { if (handleStaleError(result)) return; setFeedback(result.message ?? null); setIsPending(false); return; }
      setIsPending(false);
      window.location.reload();
    } catch {
      setFeedback("An unexpected error occurred. Please try again.");
      setIsPending(false);
    }
  }

  function productLabel(l: LineData) {
    if (l.product) return `${l.product.name} (${l.product.sku})`;
    return l.productId;
  }

  return (
    <div>
      {feedback && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-600">{feedback}</div>
      )}

      {ro.status === "OPEN" && (
        <div className="rounded-lg border p-4">
          <h3 className="mb-3 text-sm font-medium">Receive Goods</h3>
          {ro.lines.map((l) => (
            <div key={l.id} className="mb-3 flex items-center gap-3">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Line {l.lineNumber}</p>
                <p className="text-sm font-medium">{productLabel(l)}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Received Qty</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  max={Number(l.expectedQuantity)}
                  defaultValue={Number(l.expectedQuantity)}
                  onChange={(e) =>
                    setReceivedLines((prev) => ({
                      ...prev,
                      [l.id]: { ...prev[l.id], qty: e.target.value },
                    }))
                  }
                  className="w-24 rounded-md border px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Condition</label>
                <select
                  defaultValue=""
                  onChange={(e) =>
                    setReceivedLines((prev) => ({
                      ...prev,
                      [l.id]: { ...prev[l.id], condition: e.target.value },
                    }))
                  }
                  className="w-28 rounded-md border px-2 py-1.5 text-sm"
                >
                  <option value="">Auto</option>
                  <option value="GOOD">Good</option>
                  <option value="DAMAGED">Damaged</option>
                  <option value="EXPIRED">Expired</option>
                </select>
              </div>
            </div>
          ))}
          <div className="mt-3 flex items-center gap-2">
            <button onClick={handleReceive} disabled={isPending} className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {isPending ? "Receiving..." : "Confirm Receive"}
            </button>
            <button onClick={handleCancel} disabled={isPending} className="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted">
              <XCircle className="size-3.5" /> Cancel Return
            </button>
          </div>
        </div>
      )}

      {ro.status === "RECEIVED" && (
        <div className="rounded-lg border p-4">
          <h3 className="mb-3 text-sm font-medium">Complete Return</h3>

          <div className="mb-4">
            <label className="text-xs text-muted-foreground">Warehouse</label>
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            >
              {warehouses.length === 0 ? (
                <option value="">No warehouses available</option>
              ) : warehouses.length === 1 ? (
                <option value={warehouses[0].id}>{warehouses[0].name} ({warehouses[0].code})</option>
              ) : (
                <>
                  <option value="" disabled>Select warehouse...</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                  ))}
                </>
              )}
            </select>
          </div>

          {ro.lines.map((l) => (
            <div key={l.id} className="mb-3 flex items-center gap-3">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Line {l.lineNumber}</p>
                <p className="text-sm font-medium">{productLabel(l)}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Disposition</label>
                <select
                  defaultValue="RESTOCK"
                  onChange={(e) => {
                    (l as Record<string, unknown>)._disposition = e.target.value;
                  }}
                  className="w-28 rounded-md border px-2 py-1.5 text-sm"
                >
                  <option value="RESTOCK">Restock</option>
                  <option value="SCRAP">Scrap</option>
                  <option value="REPLACE">Replace</option>
                </select>
              </div>
            </div>
          ))}

          <div className="mt-3 flex items-center gap-2">
            <button onClick={handleComplete} disabled={isPending} className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {isPending ? "Completing..." : "Complete Return"}
            </button>
            <button onClick={handleCancel} disabled={isPending} className="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted">
              <XCircle className="size-3.5" /> Cancel Return
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
