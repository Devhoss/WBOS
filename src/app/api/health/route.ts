import { accessSync, existsSync, constants } from "fs";
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
  const requiredDirs = ["uploads", "backups"];

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

  for (const dir of requiredDirs) {
    const dirPath = join(storageRoot, dir);
    const ok = existsSync(dirPath);
    storageChecks[dir] = ok;
    if (!ok) healthy = false;
  }

  checks.storage = storageChecks;
  checks.environment = process.env.NODE_ENV ?? "development";
  checks.serverTime = new Date().toISOString();

  return NextResponse.json(
    { healthy, ...checks },
    { status: healthy ? 200 : 503 },
  );
}
