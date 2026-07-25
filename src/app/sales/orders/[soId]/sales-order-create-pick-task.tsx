"use client";

import { ListChecks } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { createPickTaskAction } from "@/domains/tasks/actions/task-actions";

type Worker = { id: string; name: string };

export function SalesOrderCreatePickTask({ soId, workers }: { soId: string; workers: Worker[] }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [assignedToId, setAssignedToId] = useState<string>("");

  async function create() {
    setFeedback(null);
    setIsPending(true);
    try {
      const result = await createPickTaskAction(soId, assignedToId || undefined);
      if (!result.ok) { setFeedback({ ok: false, message: result.message ?? "Failed" }); setIsPending(false); return; }
      const task = result.tasks?.[0];
      if (task?.id) {
        router.push(`/tasks/${task.id}`);
      } else {
        router.refresh();
      }
    } catch { setFeedback({ ok: false, message: "An unexpected error occurred." }); }
    setIsPending(false);
  }

  return (
    <div className="space-y-2">
      {feedback ? (
        <p className={`rounded-md px-3 py-2 text-xs ${feedback.ok ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" : "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400"}`} role="alert">
          {feedback.message}
        </p>
      ) : null}
      <label className="text-xs font-medium text-muted-foreground">Assign to</label>
      <select
        value={assignedToId}
        onChange={(e) => setAssignedToId(e.target.value)}
        className="flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm shadow-sm"
      >
        <option value="">Myself</option>
        {workers.map((w) => (
          <option key={w.id} value={w.id}>{w.name}</option>
        ))}
      </select>
      <button className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
        disabled={isPending} type="button" onClick={create}>
        <ListChecks className="size-4" />{isPending ? "Creating..." : "Create Pick Task"}
      </button>
    </div>
  );
}
