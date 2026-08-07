"use server";

import { revalidatePath } from "next/cache";

import { requireMinimumRole } from "@/infrastructure/authorization/rbac";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { BackupService } from "../services/backup-service";

export async function createBackupAction() {
  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext();
    requireMinimumRole(context, "MANAGER");

    const created = await new BackupService().createBackup(context);
    revalidatePath("/settings/backups");

    return { ok: true as const, backup: created };
  } catch (error) {
    if (error instanceof BusinessError) {
      return { ok: false as const, message: error.message };
    }
    throw error;
  }
}
