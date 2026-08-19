import { prisma } from "@/infrastructure/database/prisma";
import { TaskDomainService } from "@/domains/tasks/services/task-domain-service";

/**
 * Promotes SCHEDULED tasks to READY on a timer.
 *
 * `ensurePromotedTasks` was only ever called as a side effect of a read, so a
 * task scheduled for 07:00 stayed SCHEDULED — and its "now ready" notification
 * unsent — until somebody happened to open a task list. With the warehouse
 * phone asleep and nobody on the web app, that could be hours. The whole point
 * of a scheduled pick is the notification arriving at the scheduled moment.
 *
 * Safe to run alongside the read-triggered path, and safe to run in more than
 * one process: `promoteDueTasks` is a single conditional
 * `UPDATE ... WHERE status = 'SCHEDULED' ... RETURNING`, so exactly one caller
 * can claim a given task and only that caller notifies.
 */
const INTERVAL_MS = 60_000;

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

async function tick(): Promise<void> {
  // Overlapping runs would achieve nothing; the UPDATE has already claimed
  // whatever the previous tick promoted.
  if (running) return;
  running = true;
  try {
    const domain = new TaskDomainService();
    const organizations = await prisma.organization.findMany({ select: { id: true } });
    const boundary = new Date();

    for (const { id } of organizations) {
      try {
        await domain.ensurePromotedTasks(id, boundary);
      } catch (error) {
        console.error(`[scheduler] Promotion failed for organization ${id}:`, error);
      }
    }
  } catch (error) {
    console.error("[scheduler] Promotion sweep failed:", error);
  } finally {
    running = false;
  }
}

export function startTaskPromotionScheduler(): void {
  if (timer) return;
  if (process.env.WBOS_DISABLE_SCHEDULER === "1") {
    console.info("[scheduler] Task promotion disabled by WBOS_DISABLE_SCHEDULER.");
    return;
  }

  console.info(`[scheduler] Task promotion sweep every ${INTERVAL_MS / 1000}s.`);
  timer = setInterval(() => void tick(), INTERVAL_MS);
  // Never hold the process open on its own account.
  timer.unref?.();
  void tick();
}

export function stopTaskPromotionScheduler(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
