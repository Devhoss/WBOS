/**
 * Runs once per server process on boot.
 *
 * Guarded to the Node runtime: the Edge runtime has no timers worth using and
 * no Prisma client.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { startTaskPromotionScheduler } = await import(
    "@/infrastructure/scheduler/task-promotion-scheduler"
  );
  startTaskPromotionScheduler();
}
