import { NextResponse } from "next/server";
import { existsSync } from "node:fs";
import path from "node:path";

import { prisma } from "@/infrastructure/database/prisma";

export const dynamic = "force-dynamic";

const startTime = Date.now();

export async function GET() {
  const checks: Record<string, unknown> = {};
  let healthy = true;

  checks.app = { uptime: Math.floor((Date.now() - startTime) / 1000), status: "running" };

  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbLatency = Date.now() - dbStart;
    checks.database = { connected: true, latency: `${dbLatency}ms` };
  } catch (e) {
    checks.database = { connected: false, error: String(e) };
    healthy = false;
  }

  try {
    const org = await prisma.organization.findFirst({ select: { id: true } });
    checks.prisma = { connected: true, organizationExists: !!org };
  } catch (e) {
    checks.prisma = { connected: false, error: String(e) };
    healthy = false;
  }

  const storageRoot = process.env.WBOS_STORAGE_ROOT || "./storage";
  try {
    const storagePath = path.resolve(storageRoot);
    const exists = existsSync(storagePath);
    checks.storage = { path: storageRoot, exists, writable: exists };
  } catch {
    checks.storage = { path: storageRoot, error: "cannot access" };
  }

  checks.environment = process.env.NODE_ENV || "development";
  checks.serverTime = new Date().toISOString();

  return NextResponse.json({
    healthy,
    ...checks,
  });
}
