import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { requireMinimumRole } from "@/infrastructure/authorization/rbac";

import { BackupService } from "@/domains/backups/services/backup-service";
import { BackupPanel } from "./backup-panel";

export const metadata: Metadata = { title: "Backup & Restore" };

export default async function SettingsBackupsPage() {
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  requireMinimumRole(context, "MANAGER");

  const service = new BackupService();
  const [backups, status] = await Promise.all([service.listBackups(), service.getStatus()]);

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="border-b pb-6">
          <h1 className="text-2xl font-semibold tracking-normal">Backup &amp; Restore</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Create on-demand backups of your database and uploads, and restore from a package when needed.
            Scheduled backups run via the host cron job documented in PRODUCTION_READINESS.md.
          </p>
        </div>

        <BackupPanel
          backups={backups}
          lastBackupAt={status.lastBackupAt}
          lastRestoreTest={status.lastRestoreTest}
          canRestore={context.role === "OWNER"}
        />
      </div>
    </AppShell>
  );
}
