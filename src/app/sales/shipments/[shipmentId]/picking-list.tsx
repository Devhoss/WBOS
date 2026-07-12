"use client";

import { CheckCircle2, Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { BarcodeScanInput } from "@/components/barcode-scan-input";
import { manualPickAction } from "@/domains/sales/actions/manual-pick";
import { scanPickAction } from "@/domains/sales/actions/scan-pick";

type ShipmentLine = {
  id: string;
  productName: string;
  productSku: string;
  product: { barcode: string | null } | null;
  quantity: string;
  pickedQuantity: string;
  notes: string | null;
};

export function PickingList({
  lines,
  shipmentId,
  status,
}: {
  lines: ShipmentLine[];
  shipmentId: string;
  status: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [manualQty, setManualQty] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<string | null>(null);

  const fullyPickedBarcodes = new Set(
    lines
      .filter((l) => l.product?.barcode && Number(l.pickedQuantity) >= Number(l.quantity))
      .map((l) => l.product!.barcode!),
  );

  const totalScanned = lines.reduce((s, l) => s + Number(l.pickedQuantity), 0);
  const totalRequired = lines.reduce((s, l) => s + Number(l.quantity), 0);
  const totalPct = totalRequired > 0 ? Math.round((totalScanned / totalRequired) * 100) : 0;

  async function handleScan(barcode: string) {
    const result = await scanPickAction({ shipmentId, barcode });
    if (result.ok) router.refresh();
    return result;
  }

  async function handleManualPick(lineId: string) {
    const qty = Number.parseFloat(manualQty[lineId] || "0");
    if (qty <= 0) return;
    setFeedback(null);
    startTransition(async () => {
      const result = await manualPickAction({ shipmentId, lineId, quantity: qty });
      if (!result.ok) {
        setFeedback(result.message ?? "Pick failed.");
      } else {
        setManualQty((prev) => ({ ...prev, [lineId]: "" }));
        router.refresh();
      }
    });
  }

  return (
    <section className="rounded-lg border p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold">Picking List</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {totalScanned.toFixed(3)} / {totalRequired.toFixed(3)} picked ({totalPct}%)
          </p>
        </div>
        <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-muted sm:w-48">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${totalPct}%` }}
          />
        </div>
      </div>

      {status !== "PICKED" ? (
        <div className="mt-4 space-y-4">
          <BarcodeScanInput
            placeholder="Scan product barcode..."
            onScan={handleScan}
            scannedIds={[...fullyPickedBarcodes]}
            autoFocus
            scanTimeout={80}
          />

          {feedback ? (
            <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-950 dark:text-red-400" role="alert">{feedback}</p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 space-y-2">
        {lines.map((line) => {
          const ordered = Number(line.quantity);
          const picked = Number(line.pickedQuantity);
          const remaining = ordered - picked;
          const isComplete = picked >= ordered;
          const pct = ordered > 0 ? Math.round((picked / ordered) * 100) : 0;

          return (
            <div key={line.id} className={`rounded-md border p-3 text-sm ${isComplete ? "bg-emerald-50/60 dark:bg-emerald-950/20" : ""}`}>
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{line.productName}</span>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">{line.productSku}</span>
                    {line.product?.barcode ? (
                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">[{line.product.barcode}]</span>
                    ) : null}
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>Ordered: <strong className="font-mono tabular-nums text-foreground">{ordered.toFixed(3)}</strong></span>
                    <span>Picked: <strong className="font-mono tabular-nums text-emerald-600">{picked.toFixed(3)}</strong></span>
                    <span>Remaining: <strong className="font-mono tabular-nums text-amber-600">{remaining.toFixed(3)}</strong></span>
                  </div>

                  <div className="mt-1.5 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-all ${isComplete ? "bg-emerald-500" : "bg-blue-500"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="mt-0.5 block text-[10px] text-muted-foreground">{pct}% complete</span>
                </div>

                {isComplete ? (
                  <CheckCircle2 className="size-5 shrink-0 text-emerald-500" />
                ) : null}
              </div>

              {!isComplete && status !== "PICKED" ? (
                <div className="mt-3 flex items-center gap-2">
                  <input
                    className="h-8 w-20 rounded-md border bg-background px-2 text-right text-sm outline-none focus:border-primary"
                    min="0.001" step="0.001" type="number"
                    placeholder="Qty"
                    value={manualQty[line.id] ?? ""}
                    onChange={(e) => setManualQty((prev) => ({ ...prev, [line.id]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === "Enter") handleManualPick(line.id); }}
                  />
                  <button
                    className="inline-flex h-8 items-center gap-1 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
                    disabled={isPending || !manualQty[line.id] || Number(manualQty[line.id]) <= 0}
                    type="button"
                    onClick={() => handleManualPick(line.id)}
                  >
                    <Plus className="size-3" /> Apply
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
