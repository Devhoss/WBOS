import { NextResponse } from "next/server";

import { prisma } from "@/infrastructure/database/prisma";

export const dynamic = "force-dynamic";
import { chromium } from "playwright";
import { existsSync } from "node:fs";
import path from "node:path";

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

    try {
      await prisma.$queryRaw`SELECT COUNT(*)::int as cnt FROM pg_stat_activity WHERE datname = current_database()`;
    } catch {
      // non-critical
    }
  } catch (e) {
    checks.database = { connected: false, error: String(e) };
    healthy = false;
  }

  try {
    await prisma.$queryRaw`SELECT id FROM "Organization" LIMIT 1`;
    checks.prisma = { connected: true };
  } catch (e) {
    checks.prisma = { connected: false, error: String(e) };
    healthy = false;
  }

  try {
    const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.setContent("<html><body><p>ok</p></body></html>");
    const title = await page.title();
    await context.close();
    await browser.close();
    checks.playwright = { available: true, title };
  } catch (e) {
    checks.playwright = { available: false, error: String(e) };
  }

  const storageRoot = process.env.WBOS_STORAGE_ROOT || "./storage";
  try {
    const storagePath = path.resolve(storageRoot);
    const exists = existsSync(storagePath);
    checks.storage = { path: storageRoot, exists, writable: exists };
  } catch {
    checks.storage = { path: storageRoot, error: "cannot access" };
  }

  const version = "0.1.0";
  checks.version = version;
  checks.environment = process.env.NODE_ENV || "development";
  checks.serverTime = new Date().toISOString();

  return NextResponse.json({
    healthy,
    ...checks,
  });
}
