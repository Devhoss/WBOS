const DEFAULT_BACKUP_STALENESS_HOURS = 48;

/**
 * Backup staleness threshold, in hours. Keep aligned with
 * `WBOS_ALERT_BACKUP_STALE_HOURS` used by scripts/health-alert.sh.
 */
export function resolveBackupStalenessHours(): number {
  const raw = process.env.WBOS_HEALTH_BACKUP_STALE_HOURS;
  if (!raw) return DEFAULT_BACKUP_STALENESS_HOURS;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_BACKUP_STALENESS_HOURS;
}

export type BackupFreshness = {
  /** No backup has ever been taken — Day-0 bootstrap, not a fault. */
  neverBackedUp: boolean;
  /** A backup exists but is older than the threshold — a real failure. */
  stale: boolean;
  /** Whether this should flip the app's overall health (and the container healthcheck). */
  unhealthy: boolean;
};

/**
 * Decide what "no fresh backup" means for container health.
 *
 * A brand-new deployment has no backups yet. Treating that as unhealthy makes
 * the Docker healthcheck fail on a fresh install, which blocks the very first
 * deploy from completing and leaves the container permanently unhealthy until
 * someone takes a backup — a bootstrap deadlock.
 *
 * So "never backed up" is reported but does NOT flip health. A backup that
 * EXISTS and has gone stale is a genuine failure and does. Either way
 * scripts/health-alert.sh alerts the operator, so the Day-0 state still reaches
 * a human — it just doesn't take the app down.
 */
export function evaluateBackupFreshness(
  latestAgeHours: number | null,
  thresholdHours: number = resolveBackupStalenessHours(),
): BackupFreshness {
  if (latestAgeHours === null) {
    return { neverBackedUp: true, stale: false, unhealthy: false };
  }
  const stale = latestAgeHours > thresholdHours;
  return { neverBackedUp: false, stale, unhealthy: stale };
}
