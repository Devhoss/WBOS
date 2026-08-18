"use server";

import { requireManager } from "@/infrastructure/authorization/rbac";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { BackupService } from "../services/backup-service";

export async function getBackupStatusAction() {
  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext();
    requireManager(context);

    const service = new BackupService();
    const [backups, status] = await Promise.all([service.listBackups(), service.getStatus()]);

    return { ok: true as const, backups, status };
  } catch (error) {
    if (error instanceof BusinessError) {
      return { ok: false as const, message: error.message };
    }
    throw error;
  }
}
