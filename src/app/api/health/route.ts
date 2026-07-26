import { accessSync, existsSync, constants, readdirSync, statSync } from "fs";
import { join } from "path";

import { NextResponse } from "next/server";

import { prisma } from "@/infrastructure/database/prisma";

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
  storageChecks.uploads = existsSync(uploadsDir);

  checks.storage = storageChecks;

  const backupsDir = process.env.WBOS_BACKUP_DIR ?? "./backups";
  const backupTiers = ["daily", "weekly", "monthly", "yearly", "uploads"];
  const tierCounts: Record<string, number> = {};
  let totalBackupFiles = 0;
  let latestBackupAge = Infinity;

  for (const tier of backupTiers) {
    const tierPath = join(backupsDir, tier);
    if (existsSync(tierPath)) {
      const files = readdirSync(tierPath).filter(
        (f) => f.endsWith(".sql.gz") || f.endsWith(".tar.gz"),
      );
      tierCounts[tier] = files.length;
      totalBackupFiles += files.length;
      if (files.length > 0) {
        const mtimes = files.map((f) => statSync(join(tierPath, f)).mtimeMs);
        latestBackupAge = Math.min(latestBackupAge, ...mtimes);
      }
    } else {
      tierCounts[tier] = 0;
    }
  }

  checks.backups = {
    root: backupsDir,
    totalFiles: totalBackupFiles,
    tiers: tierCounts,
    latestAgeHours:
      latestBackupAge < Infinity
        ? Math.round((Date.now() - latestBackupAge) / 3600000)
        : null,
  };

  checks.environment = process.env.NODE_ENV ?? "development";
  checks.serverTime = new Date().toISOString();

  return NextResponse.json(
    { healthy, ...checks },
    { status: healthy ? 200 : 503 },
  );
}
