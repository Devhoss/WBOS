"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { updateShipmentStatusAction } from "../../../domains/sales/actions/update-shipment-status";

const nextStatus: Record<string, string> = {
  PICKED: "LOADED",
  LOADED: "OUT_FOR_DELIVERY",
};

export function ShipmentStatusAction({ shipmentId, currentStatus }: { shipmentId: string; currentStatus: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const next = nextStatus[currentStatus];

  if (!next) return null;

  async function advance() {
    setFeedback(null);
    const result = await updateShipmentStatusAction({ id: shipmentId, status: next });
    if (!result.ok) { setFeedback(result.message ?? "Failed to update status."); return; }
    router.refresh();
  }

  return (
    <div>
      {feedback ? <p className="mb-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-950 dark:text-red-400" role="alert">{feedback}</p> : null}
      <button className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
        disabled={isPending} type="button" onClick={() => startTransition(() => void advance())}>
        {isPending ? "Updating..." : `Mark as ${next.replace(/_/g, " ")}`}
      </button>
    </div>
  );
}
