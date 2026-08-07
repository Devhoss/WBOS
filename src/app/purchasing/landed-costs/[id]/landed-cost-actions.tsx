"use client";

import { CheckCircle, XCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cancelLandedCost } from "@/domains/purchasing/actions/cancel-landed-cost";
import { postLandedCost } from "@/domains/purchasing/actions/post-landed-cost";

export function LandedCostActions({
  id,
  status,
  canPost,
  canCancel,
}: {
  id: string;
  status: string;
  canPost: boolean;
  canCancel: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<"post" | "cancel" | null>(null);

  async function post() {
    setFeedback(null);
    const result = await postLandedCost({ id });
    if (!result.ok) { setFeedback(result.message ?? null); return; }
    router.refresh();
  }

  async function cancel() {
    setFeedback(null);
    const result = await cancelLandedCost({ id });
    if (!result.ok) { setFeedback(result.message ?? null); return; }
    router.refresh();
  }

  if (!canPost && !canCancel) return null;

  return (
    <section className="rounded-lg border p-5">
      <h2 className="text-sm font-semibold">Actions</h2>
      <div className="mt-3 space-y-2">
        {feedback ? (
          <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-950 dark:text-red-400" role="alert">
            {feedback}
          </p>
        ) : null}
        {canPost ? (
          <button
            className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            disabled={isPending}
            type="button"
            onClick={() => setConfirmAction("post")}
          >
            <CheckCircle className="size-4" />
            {isPending ? "Posting..." : "Post Landed Cost"}
          </button>
        ) : null}
        {canCancel ? (
          <button
            className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-red-200 px-3 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-60 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
            disabled={isPending}
            type="button"
            onClick={() => setConfirmAction("cancel")}
          >
            <XCircle className="size-4" />
            {isPending ? "Cancelling..." : "Cancel Landed Cost"}
          </button>
        ) : null}
      </div>
      <ConfirmDialog
        open={confirmAction !== null}
        onOpenChange={(open) => { if (!open) setConfirmAction(null); }}
        title={confirmAction === "post" ? "Post landed cost" : "Cancel landed cost"}
        description={confirmAction === "post"
          ? "Post this landed cost? This revalues on-hand inventory and cannot be reversed except by cancellation."
          : "Cancel this landed cost? This reverses the inventory revaluation."}
        confirmLabel={confirmAction === "post" ? "Post" : "Cancel"}
        destructive={confirmAction !== "post"}
        busy={isPending}
        onConfirm={() => startTransition(async () => {
          if (confirmAction === "post") {
            await post();
          } else if (confirmAction === "cancel") {
            await cancel();
          }
          setConfirmAction(null);
        })}
      />
    </section>
  );
}
