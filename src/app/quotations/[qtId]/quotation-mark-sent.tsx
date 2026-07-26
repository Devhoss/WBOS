"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Send } from "lucide-react";
import { markQuotationSentAction } from "@/domains/quotations/actions/mark-quotation-sent";

export function QuotationMarkSent({ qtId }: { qtId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    const result = await markQuotationSentAction(qtId);
    if (result.ok) {
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <button
      onClick={handleClick}
      disabled={busy}
      className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
    >
      <Send className="size-4" />
      {busy ? "Marking..." : "Mark as Sent"}
    </button>
  );
}
