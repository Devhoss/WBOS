"use client";

import { Archive, CheckCircle, XCircle } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { archiveSupplierInvoice } from "@/domains/supplier-invoices/actions/archive-supplier-invoice";
import { cancelSupplierInvoice } from "@/domains/supplier-invoices/actions/cancel-supplier-invoice";
import { issueSupplierInvoice } from "@/domains/supplier-invoices/actions/issue-supplier-invoice";

export function SupplierInvoiceActions({
  siId,
  status,
  archivedAt,
}: {
  siId: string;
  status: string;
  archivedAt: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  async function issue() {
    setFeedback(null);
    const result = await issueSupplierInvoice({ id: siId });
    if (!result.ok) { setFeedback(result.message ?? null); return; }
    router.refresh();
  }

  async function cancel() {
    setFeedback(null);
    const result = await cancelSupplierInvoice({ id: siId });
    if (!result.ok) { setFeedback(result.message ?? null); return; }
    router.refresh();
  }

  async function archiveDoc() {
    setFeedback(null);
    const result = await archiveSupplierInvoice({ id: siId });
    if (!result.ok) { setFeedback(result.message ?? null); return; }
    router.refresh();
  }

  return (
    <div className="space-y-2">
      {feedback ? <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-950 dark:text-red-400" role="alert">{feedback}</p> : null}
      {status === "DRAFT" ? (
        <button className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60" disabled={isPending} type="button" onClick={() => startTransition(() => void issue())}>
          <CheckCircle className="size-4" />{isPending ? "Issuing..." : "Issue Invoice"}
        </button>
      ) : null}
      {status === "DRAFT" ? (
        <Link href={`/purchasing/supplier-invoices/${siId}/edit`} className="inline-flex h-9 w-full items-center justify-center rounded-md border px-3 text-sm font-medium transition hover:bg-muted">
          Edit
        </Link>
      ) : null}
      {["DRAFT", "ISSUED"].includes(status) ? (
        <button className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-red-200 px-3 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-60 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950" disabled={isPending} type="button" onClick={() => startTransition(() => void cancel())}>
          <XCircle className="size-4" />{isPending ? "Cancelling..." : "Cancel Invoice"}
        </button>
      ) : null}
      {!archivedAt ? (
        <button className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium text-muted-foreground transition hover:bg-muted disabled:opacity-60" disabled={isPending} type="button" onClick={() => startTransition(() => void archiveDoc())}>
          <Archive className="size-4" />{isPending ? "Archiving..." : "Archive"}
        </button>
      ) : null}
    </div>
  );
}