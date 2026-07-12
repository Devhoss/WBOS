"use client";

import { useState, useTransition } from "react";

import { completeCycleCount } from "@/domains/inventory/actions/complete-cycle-count";
import { approveCycleCount } from "@/domains/inventory/actions/approve-cycle-count";

export function CountActions({ countId, status }: { countId: string; status: string }) {
  const [completePending, startComplete] = useTransition();
  const [approvePending, startApprove] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  function handleComplete() {
    setFeedback(null);
    startComplete(async () => {
      const result = await completeCycleCount({ countId });
      if (!result.ok) { setFeedback(result.message ?? "Failed to complete."); return; }
    });
  }

  function handleApprove() {
    setFeedback(null);
    startApprove(async () => {
      const result = await approveCycleCount({ countId });
      if (!result.ok) { setFeedback(result.message ?? "Failed to approve."); return; }
    });
  }

  if (status !== "DRAFT" && status !== "IN_PROGRESS" && status !== "COMPLETED") return null;

  return (
    <section className="rounded-lg border p-5">
      <h2 className="text-sm font-semibold">Actions</h2>

      {feedback ? (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-950 dark:text-red-400" role="alert">
          {feedback}
        </p>
      ) : null}

      <div className="mt-3 space-y-2">
        {(status === "DRAFT" || status === "IN_PROGRESS") ? (
          <button
            className="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            disabled={completePending}
            type="button"
            onClick={handleComplete}
          >
            {completePending ? "Completing..." : "Complete Count"}
          </button>
        ) : null}

        {status === "COMPLETED" ? (
          <button
            className="inline-flex h-9 w-full items-center justify-center rounded-md bg-emerald-600 px-4 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
            disabled={approvePending}
            type="button"
            onClick={handleApprove}
          >
            {approvePending ? "Approving..." : "Approve & Post Adjustments"}
          </button>
        ) : null}
      </div>

      {status === "COMPLETED" ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Approval posts inventory adjustments for lines with non-zero variance.
        </p>
      ) : null}
    </section>
  );
}
