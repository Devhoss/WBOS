import { afterEach, describe, expect, it } from "vitest";

import {
  evaluateBackupFreshness,
  resolveBackupStalenessHours,
} from "@/infrastructure/health/backup-freshness";

describe("evaluateBackupFreshness", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("does not fail health on a fresh deployment that has never been backed up", () => {
    // Day-0 bootstrap: failing here makes the Docker healthcheck fail before a
    // backup can exist, so the first deploy could never complete.
    const result = evaluateBackupFreshness(null);
    expect(result.neverBackedUp).toBe(true);
    expect(result.stale).toBe(false);
    expect(result.unhealthy).toBe(false);
  });

  it("fails health when an existing backup has gone stale", () => {
    const result = evaluateBackupFreshness(72, 48);
    expect(result.neverBackedUp).toBe(false);
    expect(result.stale).toBe(true);
    expect(result.unhealthy).toBe(true);
  });

  it("treats a backup exactly at the threshold as fresh", () => {
    const result = evaluateBackupFreshness(48, 48);
    expect(result.stale).toBe(false);
    expect(result.unhealthy).toBe(false);
  });

  it("keeps a recent backup healthy", () => {
    expect(evaluateBackupFreshness(3, 48).unhealthy).toBe(false);
  });

  it("defaults the staleness threshold to 48 hours", () => {
    delete process.env.WBOS_HEALTH_BACKUP_STALE_HOURS;
    expect(resolveBackupStalenessHours()).toBe(48);
  });

  it("honours a configured staleness threshold", () => {
    process.env.WBOS_HEALTH_BACKUP_STALE_HOURS = "24";
    expect(resolveBackupStalenessHours()).toBe(24);
    expect(evaluateBackupFreshness(30).unhealthy).toBe(true);
  });

  it("falls back to the default for a nonsense threshold", () => {
    process.env.WBOS_HEALTH_BACKUP_STALE_HOURS = "not-a-number";
    expect(resolveBackupStalenessHours()).toBe(48);
    process.env.WBOS_HEALTH_BACKUP_STALE_HOURS = "-5";
    expect(resolveBackupStalenessHours()).toBe(48);
  });
});
