"use client";

import { Clock } from "lucide-react";

import { statusColorClass, formatStatus } from "@/components/status-colors";

import type { TimelineEntry } from "./entity-timeline";

export function DocumentTimeline({ entries }: { entries: TimelineEntry[] }) {
  if (entries.length === 0) return null;

  return (
    <section className="rounded-lg border p-5">
      <h2 className="text-sm font-semibold">Timeline</h2>
      <div className="relative mt-4 pl-6">
        <div className="absolute bottom-0 left-[7px] top-0 w-px bg-border" />
        <div className="space-y-4">
          {entries.map((entry, i) => {
            const time = new Date(entry.createdAt);
            const actionKey = entry.action.replace(/PURCHASE_ORDER_|SALES_ORDER_|INVOICE_|SHIPMENT_/, "");

            return (
              <div key={i} className="relative">
                <div className="absolute -left-[19px] mt-1.5 flex size-[14px] items-center justify-center rounded-full border-2 border-background bg-muted">
                  <Clock className="size-[6px] text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm">{entry.summary}</p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      {" "}&middot;{" "}
                      {time.toLocaleDateString()}
                    </span>
                    <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${statusColorClass(actionKey)}`}>
                      {formatStatus(actionKey)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
