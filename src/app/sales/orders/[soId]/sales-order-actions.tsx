"use client";

import { Archive, CheckCircle, Send, Trash2, XCircle } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { approveSalesOrderAction } from "@/domains/sales/actions/approve-sales-order";
import { archiveSalesOrderAction } from "@/domains/sales/actions/archive-sales-order";
import { cancelSalesOrderAction } from "@/domains/sales/actions/cancel-sales-order";
import { deleteSalesOrder } from "@/domains/sales/actions/delete-sales-order";
import { submitSalesOrderAction } from "@/domains/sales/actions/submit-sales-order";

const staleStatusErrors = [
  "Only pending approval orders can be approved.",
  "This sales order cannot be cancelled.",
  "Only draft or pending approval orders can be deleted.",
  "Only approved, invoiced, paid, or cancelled orders can be archived.",
];

export function SalesOrderActions({ poId, status, archivedAt }: { poId: string; status: string; archivedAt: string | null }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  function isStale(message: string | null | undefined): boolean {
    return message ? staleStatusErrors.includes(message) || message.startsWith("Cannot transition from") : false;
  }

  function reload() {
    window.location.reload();
  }

  async function submit() {
    setIsPending(true);
    try {
      const result = await submitSalesOrderAction({ id: poId });
      if (!result.ok) { if (isStale(result.message)) { reload(); return; } setIsPending(false); return; }
      setIsPending(false);
      reload();
    } catch { setIsPending(false); }
  }

  async function approve() {
    setIsPending(true);
    try {
      const result = await approveSalesOrderAction({ id: poId });
      if (!result.ok) { if (isStale(result.message)) { reload(); return; } setIsPending(false); return; }
      setIsPending(false);
      reload();
    } catch { setIsPending(false); }
  }

  async function cancel() {
    setIsPending(true);
    try {
      const result = await cancelSalesOrderAction({ id: poId });
      if (!result.ok) { if (isStale(result.message)) { reload(); return; } setIsPending(false); return; }
      setIsPending(false);
      reload();
    } catch { setIsPending(false); }
  }

  async function archiveDoc() {
    setIsPending(true);
    try {
      const result = await archiveSalesOrderAction({ id: poId });
      if (!result.ok) { if (isStale(result.message)) { reload(); return; } setIsPending(false); return; }
      setIsPending(false);
      reload();
    } catch { setIsPending(false); }
  }

  async function deleteDoc() {
    if (!window.confirm("Delete this order? This action cannot be undone.")) return;
    setIsPending(true);
    try {
      const result = await deleteSalesOrder({ id: poId });
      if (!result.ok) { if (isStale(result.message)) { reload(); return; } setIsPending(false); return; }
      router.push("/sales/orders");
    } catch { setIsPending(false); }
  }

  return (
    <div className="space-y-2">
      {status === "DRAFT" ? (
        <button className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          disabled={isPending} type="button" onClick={submit}>
          <Send className="size-4" />{isPending ? "Submitting..." : "Submit for Approval"}
        </button>
      ) : null}
      {status === "PENDING_APPROVAL" ? (
        <button className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          disabled={isPending} type="button" onClick={approve}>
          <CheckCircle className="size-4" />{isPending ? "Approving..." : "Approve"}
        </button>
      ) : null}
      {["DRAFT", "PENDING_APPROVAL", "APPROVED", "READY_FOR_INVOICE"].includes(status) ? (
        <button className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-red-200 px-3 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-60 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
          disabled={isPending} type="button" onClick={cancel}>
          <XCircle className="size-4" />{isPending ? "Cancelling..." : "Cancel Order"}
        </button>
      ) : null}
      {["DRAFT", "PENDING_APPROVAL"].includes(status) && !archivedAt ? (
        <button className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-red-400 px-3 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-60 dark:border-red-600 dark:text-red-400 dark:hover:bg-red-950"
          disabled={isPending} type="button" onClick={deleteDoc}>
          <Trash2 className="size-4" />{isPending ? "Deleting..." : "Delete Permanently"}
        </button>
      ) : null}
      {["APPROVED", "READY_FOR_INVOICE", "INVOICED", "PAID", "CANCELLED"].includes(status) && !archivedAt ? (
        <button className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium text-muted-foreground transition hover:bg-muted disabled:opacity-60"
          disabled={isPending} type="button" onClick={archiveDoc}>
          <Archive className="size-4" />{isPending ? "Archiving..." : "Archive"}
        </button>
      ) : null}
    </div>
  );
}
