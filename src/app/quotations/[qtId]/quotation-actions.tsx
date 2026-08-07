"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { XCircle } from "lucide-react";
import { cancelQuotationAction } from "@/domains/quotations/actions/cancel-quotation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export function QuotationActions({ qtId }: { qtId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  async function handleCancel() {
    setBusy(true);
    const result = await cancelQuotationAction(qtId);
    if (result.ok) {
      router.refresh();
    }
    setBusy(false);
    setConfirmCancel(false);
  }

  return (
    <>
      <button
        onClick={() => setConfirmCancel(true)}
        disabled={busy}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-destructive px-3 py-2 text-sm font-medium text-destructive transition hover:bg-destructive/10 disabled:opacity-60"
      >
        <XCircle className="size-4" />
        {busy ? "Cancelling..." : "Cancel Quotation"}
      </button>
      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Cancel quotation"
        description="Are you sure you want to cancel this quotation?"
        confirmLabel="Cancel Quotation"
        busy={busy}
        onConfirm={() => void handleCancel()}
      />
    </>
  );
}
