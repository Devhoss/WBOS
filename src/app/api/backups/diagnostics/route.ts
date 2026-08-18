import { NextResponse } from "next/server";

import { requireManager } from "@/infrastructure/authorization/rbac";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { BackupService } from "@/domains/backups/services/backup-service";

export async function GET() {
  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext();
    requireManager(context);

    const diagnostics = await new BackupService().getDiagnostics();

    return NextResponse.json({
      processPath: diagnostics.path.split(/[;:]/).filter(Boolean),
      tools: diagnostics.tools,
    });
  } catch (error) {
    if (error instanceof BusinessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
