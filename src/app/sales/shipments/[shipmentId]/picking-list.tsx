"use client";

import { Smartphone } from "lucide-react";

type LineProps = {
  id: string;
  productName: string;
  productSku: string;
  product: { barcode: string | null } | null;
  quantity: number;
  pickedQuantity: number;
  notes: string | null;
};

export function PickingList({
  lines,
  status,
}: {
  lines: LineProps[];
  status: string;
}) {
  const totalScanned = lines.reduce((s, l) => s + Number(l.pickedQuantity), 0);
  const totalRequired = lines.reduce((s, l) => s + Number(l.quantity), 0);
  const totalPct = totalRequired > 0 ? Math.round((totalScanned / totalRequired) * 100) : 0;

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
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
          <div className="flex items-start gap-3">
            <Smartphone className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="text-sm">
              <p className="font-medium text-amber-800 dark:text-amber-300">
                Picking moved to mobile app
              </p>
              <p className="mt-1 text-amber-700 dark:text-amber-400">
                Use the mobile picking app to scan barcodes. Web-based picking has been deprecated.
              </p>
            </div>
          </div>
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
            </div>
          );
        })}
      </div>
    </section>
  );
}

function CheckCircle2(props: { className?: string }) {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>;
}
