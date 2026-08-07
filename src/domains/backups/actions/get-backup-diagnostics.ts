"use server";

import { requireMinimumRole } from "@/infrastructure/authorization/rbac";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { BackupService } from "../services/backup-service";

export async function getBackupDiagnosticsAction() {
  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext();
    requireMinimumRole(context, "MANAGER");

    const diagnostics = await new BackupService().getDiagnostics();
    return { ok: true as const, diagnostics };
  } catch (error) {
    if (error instanceof BusinessError) {
      return { ok: false as const, message: error.message };
    }
    throw error;
  }
}
