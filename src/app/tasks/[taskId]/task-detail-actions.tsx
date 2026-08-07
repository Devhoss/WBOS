"use client";

import { CheckCircle, Play, XCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { startTaskAction, completeTaskAction, cancelTaskAction } from "@/domains/tasks/actions/task-actions";
import { ReasonDialog } from "@/components/ui/reason-dialog";

export function TaskDetailActions({ taskId, status, updatedAt }: { taskId: string; status: string; updatedAt: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  async function start() {
    setFeedback(null);
    const result = await startTaskAction(taskId, updatedAt);
    if (!result.ok) { setFeedback(result.message ?? null); return; }
    router.refresh();
  }

  async function complete() {
    setFeedback(null);
    const result = await completeTaskAction(taskId, updatedAt);
    if (!result.ok) { setFeedback(result.message ?? null); return; }
    router.refresh();
  }

  async function cancel(reason: string) {
    setFeedback(null);
    const result = await cancelTaskAction(taskId, reason || null, updatedAt);
    if (!result.ok) { setFeedback(result.message ?? null); return; }
    router.refresh();
  }

  function handleConfirmCancel(reason: string) {
    startTransition(async () => {
      setConfirmCancel(false);
      await cancel(reason);
    });
  }

  return (
    <div className="flex items-center gap-2">
      {feedback ? <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-950 dark:text-red-400" role="alert">{feedback}</p> : null}
      {status === "READY" ? (
        <button className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          disabled={isPending} type="button" onClick={() => startTransition(() => void start())}>
          <Play className="size-4" />{isPending ? "Starting..." : "Start"}
        </button>
      ) : null}
      {status === "IN_PROGRESS" ? (
        <button className="inline-flex h-9 items-center gap-2 rounded-md bg-emerald-600 px-3 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
          disabled={isPending} type="button" onClick={() => startTransition(() => void complete())}>
          <CheckCircle className="size-4" />{isPending ? "Completing..." : "Complete"}
        </button>
      ) : null}
      {status !== "COMPLETED" && status !== "CANCELLED" ? (
        <button className="inline-flex h-9 items-center gap-2 rounded-md border border-red-200 px-3 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-60 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
          disabled={isPending} type="button" onClick={() => setConfirmCancel(true)}>
          <XCircle className="size-4" />{isPending ? "Cancelling..." : "Cancel"}
        </button>
      ) : null}
      <ReasonDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Cancel task"
        description="Cancelling cannot be undone. Provide a reason for the audit trail, or leave it blank."
        label="Cancellation reason"
        placeholder="Optional"
        confirmLabel="Cancel Task"
        busy={isPending}
        onConfirm={handleConfirmCancel}
      />
    </div>
  );
}
