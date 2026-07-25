"use client";

import { FileText } from "lucide-react";
import { useState } from "react";

import { generateInvoiceAction } from "../../../../domains/sales/actions/generate-invoice";

export function SalesOrderInvoiceAction({ soId }: { soId: string }) {
  const [isPending, setIsPending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function generate() {
    setFeedback(null);
    setIsPending(true);
    try {
      const result = await generateInvoiceAction({ salesOrderId: soId });
      if (!result.ok) { setFeedback(result.message ?? null); setIsPending(false); return; }
      setIsPending(false);
      window.location.reload();
    } catch { setFeedback("An unexpected error occurred."); setIsPending(false); }
  }

  return (
    <div>
      {feedback ? <p className="mb-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-950 dark:text-red-400">{feedback}</p> : null}
      <button
        className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
        disabled={isPending} type="button" onClick={generate}
      >
        <FileText className="size-4" />
        {isPending ? "Generating..." : "Generate Invoice"}
      </button>
    </div>
  );
}
