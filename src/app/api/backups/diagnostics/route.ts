import { NextRequest, NextResponse } from "next/server";

import { requireManager } from "@/infrastructure/authorization/rbac";
import { apiContext } from "@/infrastructure/request/api-context";
import { BusinessError } from "@/shared/errors/business-error";

import { BackupService } from "@/domains/backups/services/backup-service";

export async function GET(req: NextRequest) {
  try {
    const auth = await apiContext(req.headers);
    if (!auth.ok) return auth.response;
    const context = auth.context;
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
