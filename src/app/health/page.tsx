import { AppShell } from "@/components/app-shell";
import { prisma } from "@/infrastructure/database/prisma";
import { chromium } from "playwright";
import { existsSync, statSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  Activity,
  CheckCircle2,
  Clock,
  Database,
  FileText,
  Globe,
  HardDrive,
  Package,
  Server,
  XCircle,
} from "lucide-react";

const startTime = Date.now();

export const dynamic = "force-dynamic";
export const metadata = { title: "System Health" };

type StatusBlock = {
  label: string;
  value: string;
  ok: boolean;
  icon: React.ReactNode;
};

async function getHealth() {
  const blocks: StatusBlock[] = [];

  const appUptime = Math.floor((Date.now() - startTime) / 1000);
  const days = Math.floor(appUptime / 86400);
  const hours = Math.floor((appUptime % 86400) / 3600);
  const mins = Math.floor((appUptime % 3600) / 60);
  const uptimeStr = days > 0 ? `${days}d ${hours}h ${mins}m` : `${hours}h ${mins}m`;
  blocks.push({ label: "App Uptime", value: uptimeStr, ok: true, icon: <Server className="size-5" /> });

  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const latency = Date.now() - dbStart;
    blocks.push({ label: "Database", value: `Connected (${latency}ms)`, ok: true, icon: <Database className="size-5" /> });

    const orgExists = await prisma.organization.findFirst({ select: { id: true } });
    blocks.push({ label: "Prisma ORM", value: orgExists ? "Connected" : "No organization data", ok: true, icon: <Package className="size-5" /> });
  } catch {
    blocks.push({ label: "Database", value: "Disconnected", ok: false, icon: <XCircle className="size-5" /> });
    blocks.push({ label: "Prisma ORM", value: "Disconnected", ok: false, icon: <XCircle className="size-5" /> });
  }

  try {
    const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
    await browser.close();
    blocks.push({ label: "Playwright", value: "Available", ok: true, icon: <Globe className="size-5" /> });
  } catch {
    blocks.push({ label: "Playwright", value: "Unavailable", ok: false, icon: <XCircle className="size-5" /> });
  }

  const storageRoot = process.env.WBOS_STORAGE_ROOT || "./storage";
  try {
      const sp = path.resolve(storageRoot);
      const exists = existsSync(sp);
      if (exists) {
        blocks.push({ label: "Upload Storage", value: `${sp} (writable)`, ok: true, icon: <HardDrive className="size-5" /> });
      } else {
        blocks.push({ label: "Upload Storage", value: `${sp} (missing)`, ok: false, icon: <XCircle className="size-5" /> });
      }
  } catch {
    blocks.push({ label: "Upload Storage", value: "Cannot access", ok: false, icon: <XCircle className="size-5" /> });
  }

  const backupsDir = process.env.WBOS_BACKUP_DIR || "./backups";
  try {
    const bp = path.resolve(backupsDir);
    const exists = existsSync(bp);
    if (exists) {
      const files = readdirSync(bp).filter((f) => f.endsWith(".sql.gz"));
      if (files.length > 0) {
        const latest = files.sort().pop()!;
        const lStat = statSync(path.join(bp, latest));
        const ageHours = Math.round((Date.now() - lStat.mtimeMs) / 3600000);
        blocks.push({
          label: "Backups",
          value: `${files.length} file(s), latest ${ageHours}h ago`,
          ok: ageHours < 48,
          icon: <FileText className="size-5" />,
        });
      } else {
        blocks.push({ label: "Backups", value: "No backup files", ok: false, icon: <FileText className="size-5" /> });
      }
    } else {
      blocks.push({ label: "Backups", value: "Directory missing", ok: false, icon: <FileText className="size-5" /> });
    }
  } catch {
    blocks.push({ label: "Backups", value: "Cannot access", ok: false, icon: <FileText className="size-5" /> });
  }

  blocks.push({
    label: "Environment",
    value: process.env.NODE_ENV || "development",
    ok: true,
    icon: <Activity className="size-5" />,
  });

  blocks.push({
    label: "Server Time",
    value: new Date().toLocaleString(),
    ok: true,
    icon: <Clock className="size-5" />,
  });

  return { blocks, version: "0.1.0" };
}

export default async function HealthPage() {
  const { blocks, version } = await getHealth();

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="border-b pb-6">
          <h1 className="text-2xl font-semibold tracking-normal">System Health</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            v{version} &middot; {process.env.NODE_ENV || "development"} environment
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {blocks.map((b) => (
            <div
              key={b.label}
              className="rounded-lg border bg-card p-5 text-card-foreground shadow-sm"
            >
              <div className="flex items-start gap-3">
                <div
                  className={`flex size-10 shrink-0 items-center justify-center rounded-md ${
                    b.ok
                      ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"
                      : "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400"
                  }`}
                >
                  {b.ok ? <CheckCircle2 className="size-5" /> : b.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{b.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground break-all">{b.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-lg border bg-card p-4 text-sm">
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">Health API:</span>{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">GET /api/health</code> returns JSON
          </p>
        </div>
      </div>
    </AppShell>
  );
}
