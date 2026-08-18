"use server";

import { revalidatePath } from "next/cache";

import { requireOwner } from "@/infrastructure/authorization/rbac";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { BackupService } from "../services/backup-service";

export async function restoreBackupAction(input: { fileName: string; confirmation: string }) {
  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext();
    requireOwner(context);

    const result = await new BackupService().restoreBackup(context, input.fileName, input.confirmation);
    revalidatePath("/settings/backups");

    return { ok: true as const, restored: result.restoredPackage };
  } catch (error) {
    if (error instanceof BusinessError) {
      return { ok: false as const, message: error.message };
    }
    throw error;
  }
}
