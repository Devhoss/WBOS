"use client";

import { CalendarClock, Send } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { rescheduleTaskAction } from "@/domains/tasks/actions/task-actions";

function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function RescheduleTaskForm({ taskId, dueAt, updatedAt }: {
  taskId: string;
  dueAt: string | null;
  updatedAt: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [notify, setNotify] = useState(true);
  const [value, setValue] = useState(() => {
    if (dueAt) {
      const parsed = new Date(dueAt);
      if (!isNaN(parsed.getTime())) return toLocalInputValue(parsed);
    }
    return toLocalInputValue(new Date());
  });

  async function save() {
    setFeedback(null);
    setSuccess(null);
    const parsed = new Date(value);
    if (isNaN(parsed.getTime())) {
      setFeedback("Enter a valid scheduled date/time.");
      return;
    }
    const result = await rescheduleTaskAction(taskId, parsed.toISOString(), updatedAt, notify);
    if (!result.ok) {
      setFeedback(result.message ?? "Unable to reschedule task.");
      return;
    }
    setSuccess(
      result.task.status === "READY"
        ? "Task is now active and available on mobile."
        : "Task rescheduled.",
    );
    router.refresh();
  }

  return (
    <section className="rounded-lg border p-5">
      <div className="flex items-center gap-2">
        <CalendarClock className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Reschedule</h2>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Update the scheduled date/time. Saving to a past or today&apos;s time activates the task
        immediately so it appears in Today&apos;s Tasks on mobile.
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Scheduled date/time</span>
          <input
            className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
            type="datetime-local"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </label>
        <label className="flex h-10 items-center gap-2 text-sm">
          <input
            className="size-4 cursor-pointer accent-primary"
            type="checkbox"
            checked={notify}
            onChange={(e) => setNotify(e.target.checked)}
          />
          Notify the warehouse worker
        </label>
        <button
          className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          disabled={isPending}
          type="button"
          onClick={() => startTransition(() => void save())}
        >
          <Send className="size-4" />{isPending ? "Saving..." : "Save"}
        </button>
      </div>
      {feedback ? <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-950 dark:text-red-400" role="alert">{feedback}</p> : null}
      {success ? <p className="mt-2 rounded-md bg-green-50 px-3 py-2 text-xs text-green-700 dark:bg-green-950 dark:text-green-400">{success}</p> : null}
    </section>
  );
}
