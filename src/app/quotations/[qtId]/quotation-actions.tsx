"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { XCircle } from "lucide-react";
import { cancelQuotationAction } from "@/domains/quotations/actions/cancel-quotation";

export function QuotationActions({ qtId }: { qtId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleCancel() {
    if (busy) return;
    if (!window.confirm("Are you sure you want to cancel this quotation?")) return;
    setBusy(true);
    const result = await cancelQuotationAction(qtId);
    if (result.ok) {
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <button
      onClick={handleCancel}
      disabled={busy}
      className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-destructive px-3 py-2 text-sm font-medium text-destructive transition hover:bg-destructive/10 disabled:opacity-60"
    >
      <XCircle className="size-4" />
      {busy ? "Cancelling..." : "Cancel Quotation"}
    </button>
  );
}
