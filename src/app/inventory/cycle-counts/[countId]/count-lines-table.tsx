"use client";

import { CheckCircle2, Circle } from "lucide-react";
import { useState, useTransition } from "react";

import { BarcodeScanInput } from "@/components/barcode-scan-input";
import { updateCycleCountLine } from "@/domains/inventory/actions/update-cycle-count-line";
import { lookupProductByBarcode } from "@/domains/products/actions/lookup-product-by-barcode";

type Line = {
  id: string;
  productName: string;
  productSku: string;
  productBarcode: string | null;
  expectedQty: number;
  countedQty: number | null;
  variance: number | null;
  notes: string | null;
};

export function CountLinesTable({ status, lines }: { status: string; lines: Line[] }) {
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const canRecord = status === "DRAFT" || status === "IN_PROGRESS";
  const scannedBarcodes = new Set(
    lines.filter((l) => l.countedQty !== null && l.productBarcode).map((l) => l.productBarcode!),
  );

  async function handleSave(lineId: string) {
    setFeedback(null);
    startTransition(async () => {
      const result = await updateCycleCountLine({ lineId, countedQty: inputValue, notes: undefined });
      if (!result.ok) { setFeedback(result.message ?? "Failed to update."); return; }
      setEditing(null);
      setInputValue("");
    });
  }

  async function handleBarcodeScan(barcode: string) {
    const line = lines.find((l) => l.productBarcode === barcode);
    if (!line) {
      const lookup = await lookupProductByBarcode({ barcode });
      if (!lookup.ok) return { ok: false, message: lookup.message ?? "Product not found on this count." };
      return { ok: false, message: `"${lookup.data?.name}" is not in this cycle count.` };
    }
    const recorded = line.countedQty !== null;
    setEditing(line.id);
    setInputValue(recorded ? String(line.countedQty) : String(line.expectedQty));
    return { ok: true };
  }

  return (
    <section className="rounded-lg border p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Count Lines</h2>
        <span className="text-xs text-muted-foreground">
          {lines.filter((l) => l.countedQty !== null).length}/{lines.length} recorded
        </span>
      </div>

      {canRecord ? (
        <div className="mt-3">
          <BarcodeScanInput
            placeholder="Scan product..."
            onScan={handleBarcodeScan}
            scannedIds={[...scannedBarcodes]}
            autoFocus
          />
        </div>
      ) : null}

      {feedback ? (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-950 dark:text-red-400" role="alert">
          {feedback}
        </p>
      ) : null}

      <div className="mt-3 overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/70 text-xs font-semibold uppercase text-muted-foreground">
            <tr className="border-b">
              <th className="h-10 px-3 text-left">Product</th>
              <th className="h-10 px-3 text-right">Expected</th>
              <th className="h-10 px-3 text-right">Counted</th>
              <th className="h-10 px-3 text-right">Variance</th>
              <th className="h-10 px-3 text-center">Status</th>
              {canRecord ? <th className="h-10 px-3 text-center">Record</th> : null}
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const recorded = line.countedQty !== null;
              const variance = recorded ? line.expectedQty - line.countedQty! : null;
              const hasVariance = recorded && variance !== 0;

              return (
                <tr key={line.id} className="border-b last:border-b-0 hover:bg-muted/30">
                  <td className="h-12 px-3">
                    <span className="font-medium">{line.productName}</span>
                    <span className="ml-2 font-mono text-xs text-muted-foreground">{line.productSku}</span>
                    {line.productBarcode ? (
                      <span className="ml-2 font-mono text-[10px] text-muted-foreground">[{line.productBarcode}]</span>
                    ) : null}
                  </td>
                  <td className="h-12 px-3 text-right font-mono tabular-nums">{line.expectedQty.toFixed(3)}</td>
                  <td className="h-12 px-3 text-right font-mono tabular-nums">
                    {recorded ? line.countedQty!.toFixed(3) : "-"}
                  </td>
                  <td className={`h-12 px-3 text-right font-mono tabular-nums ${hasVariance ? "text-amber-600 font-semibold" : ""}`}>
                    {recorded ? (variance! > 0 ? `+${variance!.toFixed(3)}` : variance!.toFixed(3)) : "-"}
                  </td>
                  <td className="h-12 px-3 text-center">
                    {recorded ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                        <CheckCircle2 className="size-3" /> Done
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Circle className="size-3" /> Pending
                      </span>
                    )}
                  </td>
                  {canRecord ? (
                    <td className="h-12 px-3 text-center">
                      {editing === line.id ? (
                        <div className="flex items-center justify-center gap-1">
                          <input
                            className="h-7 w-20 rounded border px-1.5 text-[11px] outline-none"
                            type="number"
                            min="0"
                            step="0.001"
                            placeholder="Qty"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSave(line.id); } }}
                            autoFocus
                          />
                          <button
                            className="rounded bg-primary px-1.5 py-1 text-[10px] text-primary-foreground"
                            type="button"
                            onClick={() => handleSave(line.id)}
                          >
                            OK
                          </button>
                          <button
                            className="rounded px-1.5 py-1 text-[10px] text-muted-foreground"
                            type="button"
                            onClick={() => { setEditing(null); setInputValue(""); }}
                          >
                            X
                          </button>
                        </div>
                      ) : (
                        <button
                          className="rounded bg-primary/10 px-2 py-1 text-[11px] text-primary transition hover:bg-primary/20"
                          type="button"
                          onClick={() => {
                            setEditing(line.id);
                            setInputValue(line.countedQty?.toString() ?? "");
                          }}
                        >
                          {recorded ? "Edit" : "Count"}
                        </button>
                      )}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
