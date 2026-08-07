"use client";

import { Archive, CheckCircle, Send, Trash2, XCircle } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { approveSalesOrderAction } from "@/domains/sales/actions/approve-sales-order";
import { archiveSalesOrderAction } from "@/domains/sales/actions/archive-sales-order";
import { cancelSalesOrderAction } from "@/domains/sales/actions/cancel-sales-order";
import { deleteSalesOrder } from "@/domains/sales/actions/delete-sales-order";
import { submitSalesOrderAction } from "@/domains/sales/actions/submit-sales-order";

export function SalesOrderActions({ poId, status, archivedAt }: { poId: string; status: string; archivedAt: string | null }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function submit() {
    setFeedback(null);
    setIsPending(true);
    try {
      const result = await submitSalesOrderAction({ id: poId });
      if (!result.ok) { setFeedback(result.message ?? null); setIsPending(false); return; }
      setIsPending(false);
      router.refresh();
    } catch { setIsPending(false); }
  }

  async function approve() {
    setFeedback(null);
    setIsPending(true);
    try {
      const result = await approveSalesOrderAction({ id: poId });
      if (!result.ok) { setFeedback(result.message ?? null); setIsPending(false); return; }
      setIsPending(false);
      router.refresh();
    } catch { setIsPending(false); }
  }

  async function cancel() {
    setFeedback(null);
    setIsPending(true);
    try {
      const result = await cancelSalesOrderAction({ id: poId });
      if (!result.ok) { setFeedback(result.message ?? null); setIsPending(false); return; }
      setIsPending(false);
      router.refresh();
    } catch { setIsPending(false); }
  }

  async function archiveDoc() {
    setFeedback(null);
    setIsPending(true);
    try {
      const result = await archiveSalesOrderAction({ id: poId });
      if (!result.ok) { setFeedback(result.message ?? null); setIsPending(false); return; }
      setIsPending(false);
      router.refresh();
    } catch { setIsPending(false); }
  }

  async function deleteDoc() {
    setFeedback(null);
    setIsPending(true);
    try {
      const result = await deleteSalesOrder({ id: poId });
      if (!result.ok) { setFeedback(result.message ?? null); setIsPending(false); setConfirmDelete(false); return; }
      setConfirmDelete(false);
      router.push("/sales/orders");
    } catch { setIsPending(false); setConfirmDelete(false); }
  }

  return (
    <div className="space-y-2">
      {feedback ? <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-950 dark:text-red-400" role="alert">{feedback}</p> : null}
      {status === "DRAFT" ? (
        <button className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          disabled={isPending} type="button" onClick={() => void submit()}>
          <Send className="size-4" />{isPending ? "Submitting..." : "Submit for Approval"}
        </button>
      ) : null}
      {status === "PENDING_APPROVAL" ? (
        <button className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          disabled={isPending} type="button" onClick={() => void approve()}>
          <CheckCircle className="size-4" />{isPending ? "Approving..." : "Approve"}
        </button>
      ) : null}
      {["DRAFT", "PENDING_APPROVAL", "APPROVED", "READY_FOR_INVOICE"].includes(status) ? (
        <button className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-red-200 px-3 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-60 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
          disabled={isPending} type="button" onClick={() => void cancel()}>
          <XCircle className="size-4" />{isPending ? "Cancelling..." : "Cancel Order"}
        </button>
      ) : null}
      {["DRAFT", "PENDING_APPROVAL"].includes(status) && !archivedAt ? (
        <button className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-red-400 px-3 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-60 dark:border-red-600 dark:text-red-400 dark:hover:bg-red-950"
          disabled={isPending} type="button" onClick={() => setConfirmDelete(true)}>
          <Trash2 className="size-4" />{isPending ? "Deleting..." : "Delete Permanently"}
        </button>
      ) : null}
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete sales order"
        description="Delete this order? This action cannot be undone."
        confirmLabel="Delete"
        busy={isPending}
        onConfirm={() => void deleteDoc()}
      />
      {["APPROVED", "READY_FOR_INVOICE", "INVOICED", "PAID", "CANCELLED"].includes(status) && !archivedAt ? (
        <button className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium text-muted-foreground transition hover:bg-muted disabled:opacity-60"
          disabled={isPending} type="button" onClick={() => void archiveDoc()}>
          <Archive className="size-4" />{isPending ? "Archiving..." : "Archive"}
        </button>
      ) : null}
    </div>
  );
}
