import { accessSync, existsSync, constants, readdirSync, statSync, statfsSync } from "fs";
import { join } from "path";

import { NextResponse } from "next/server";

import { prisma } from "@/infrastructure/database/prisma";
import { BackupService } from "@/domains/backups/services/backup-service";
import { resolveStorageMinFreeBytes } from "@/infrastructure/storage/assert-capacity";
import {
  evaluateBackupFreshness,
  resolveBackupStalenessHours,
} from "@/infrastructure/health/backup-freshness";

export const dynamic = "force-dynamic";

const startTime = Date.now();

export async function GET() {
  const checks: Record<string, unknown> = {};
  let healthy = true;

  checks.app = {
    uptime: Math.floor((Date.now() - startTime) / 1000),
    status: "running",
  };

  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = {
      ok: true,
      latency: `${Date.now() - dbStart}ms`,
    };
  } catch (e) {
    checks.database = { ok: false, error: String(e) };
    healthy = false;
  }

  const prismaStart = Date.now();
  try {
    const org = await prisma.organization.findFirst({
      select: { id: true },
    });
    checks.prisma = {
      ok: true,
      latency: `${Date.now() - prismaStart}ms`,
      organizationExists: !!org,
    };
  } catch (e) {
    checks.prisma = { ok: false, error: String(e) };
    healthy = false;
  }

  const storageRoot =
    process.env.WBOS_STORAGE_ROOT ?? join(process.cwd(), "public");

  const storageChecks: Record<string, unknown> = {
    root: storageRoot,
  };

  try {
    accessSync(storageRoot, constants.F_OK | constants.W_OK);
    storageChecks.exists = true;
    storageChecks.writable = true;
  } catch {
    storageChecks.exists = existsSync(storageRoot);
    storageChecks.writable = false;
    healthy = false;
  }

  const uploadsDir = join(storageRoot, "uploads");
  const disk = checkDiskSpace([storageRoot, process.env.WBOS_BACKUP_DIR ?? "./backups"]);
  if (disk.some((d) => d.availablePercent !== null && d.availablePercent < 10)) {
    healthy = false;
  }
  const uploads = dirSizeBytes(uploadsDir);
  const storageTotalBytes = disk.find((d) => d.path === storageRoot)?.totalBytes ?? null;
  storageChecks.uploads = {
    exists: existsSync(uploadsDir),
    sizeBytes: uploads.sizeBytes,
    fileCount: uploads.fileCount,
    pctOfDisk: storageTotalBytes ? Math.round((uploads.sizeBytes / storageTotalBytes) * 100) : null,
  };
  storageChecks.minFreeBytes = resolveStorageMinFreeBytes();
  storageChecks.disk = disk;
  checks.storage = storageChecks;

  const backupsDir = process.env.WBOS_BACKUP_DIR ?? "./backups";
  const backupChecks: Record<string, unknown> = {
    root: backupsDir,
  };

  const tierCounts: Record<string, number> = {};
  let totalBackupFiles = 0;
  let latestBackupMtime = 0;

  for (const tier of ["daily", "weekly", "monthly", "yearly", "uploads"]) {
    const tierPath = join(backupsDir, tier);
    if (existsSync(tierPath)) {
      const files = readdirSync(tierPath).filter(
        (f) => f.endsWith(".sql.gz") || f.endsWith(".tar.gz"),
      );
      tierCounts[tier] = files.length;
      totalBackupFiles += files.length;
      for (const f of files) {
        latestBackupMtime = Math.max(latestBackupMtime, statSync(join(tierPath, f)).mtimeMs);
      }
    } else {
      tierCounts[tier] = 0;
    }
  }
  backupChecks.tiers = tierCounts;
  backupChecks.totalFiles = totalBackupFiles;

  const packagesDir = join(backupsDir, "packages");
  let packageFiles: string[] = [];
  if (existsSync(packagesDir)) {
    packageFiles = readdirSync(packagesDir).filter(
      (f) => f.startsWith("wbos-backup-") && f.endsWith(".tar.gz"),
    );
  }
  backupChecks.packages = { count: packageFiles.length };

  if (packageFiles.length > 0) {
    const pkgMt = packageFiles
      .map((f) => statSync(join(packagesDir, f)).mtimeMs)
      .sort((a, b) => b - a)[0];
    latestBackupMtime = Math.max(latestBackupMtime, pkgMt);
  }

  const latestAgeHours =
    latestBackupMtime > 0 ? Math.round((Date.now() - latestBackupMtime) / 3600000) : null;
  backupChecks.latestAgeHours = latestAgeHours;

  // See evaluateBackupFreshness: "never backed up" is a Day-0 bootstrap state
  // that must NOT fail the container healthcheck, while a genuinely stale
  // backup must. Alerting covers both.
  const stalenessThresholdHours = resolveBackupStalenessHours();
  const freshness = evaluateBackupFreshness(latestAgeHours, stalenessThresholdHours);
  backupChecks.neverBackedUp = freshness.neverBackedUp;
  backupChecks.stale = freshness.stale;
  backupChecks.stalenessThresholdHours = stalenessThresholdHours;
  if (freshness.unhealthy) {
    healthy = false;
  }

  const backupService = new BackupService();
  const [toolChecks, status] = await Promise.all([
    backupService.checkTools(),
    backupService.getStatus(),
  ]);
  backupChecks.tools = toolChecks;
  if (toolChecks.some((t) => !t.ok)) {
    healthy = false;
  }
  backupChecks.lastRestoreTest = status.lastRestoreTest;

  checks.backups = backupChecks;

  checks.environment = process.env.NODE_ENV ?? "development";
  checks.serverTime = new Date().toISOString();

  return NextResponse.json(
    { healthy, ...checks },
    { status: healthy ? 200 : 503 },
  );
}

function checkDiskSpace(paths: string[]) {
  return paths.map((p) => {
    try {
      const s = statfsSync(p);
      const availablePercent =
        s.bavail && s.blocks ? Math.round((s.bavail / s.blocks) * 100) : null;
      return {
        path: p,
        freeBytes: s.bavail * s.bsize,
        totalBytes: s.blocks * s.bsize,
        availablePercent,
      };
    } catch (error) {
      return {
        path: p,
        freeBytes: null,
        totalBytes: null,
        availablePercent: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });
}

function dirSizeBytes(root: string): { sizeBytes: number; fileCount: number } {
  let sizeBytes = 0;
  let fileCount = 0;
  const walk = (dir: string): void => {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      const p = join(dir, name);
      let st;
      try {
        st = statSync(p);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        walk(p);
      } else if (st.isFile()) {
        sizeBytes += st.size;
        fileCount += 1;
      }
    }
  };
  walk(root);
  return { sizeBytes, fileCount };
}
