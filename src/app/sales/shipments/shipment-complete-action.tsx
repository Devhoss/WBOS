"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { confirmDeliveryAction } from "../../../domains/sales/actions/confirm-delivery";

export function ShipmentDeliverAction({ shipmentId, returning }: { shipmentId: string; returning?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function deliver() {
    startTransition(async () => {
      const result = await confirmDeliveryAction({ id: shipmentId });
      if (!result.ok) return;
      if (returning) router.push(returning);
      else router.refresh();
    });
  }

  return (
    <button className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
      disabled={isPending} type="button" onClick={deliver}>
      {isPending ? "Delivering..." : "Confirm Delivery"}
    </button>
  );
}
