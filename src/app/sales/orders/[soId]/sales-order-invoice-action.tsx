"use client";

import { FileText } from "lucide-react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { generateInvoiceAction } from "../../../../domains/sales/actions/generate-invoice";

export function SalesOrderInvoiceAction({ soId }: { soId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function generate() {
    startTransition(async () => {
      await generateInvoiceAction({ salesOrderId: soId });
      router.refresh();
    });
  }

  return (
    <button
      className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
      disabled={isPending} type="button" onClick={generate}
    >
      <FileText className="size-4" />
      {isPending ? "Generating..." : "Generate Invoice"}
    </button>
  );
}
