import { NextRequest, NextResponse } from "next/server";

import { TaskApplicationService } from "@/domains/tasks/services/task-application-service";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

const app = new TaskApplicationService();

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext();
    const { taskId } = await params;

    const detail = await app.getPickingDetail(context, taskId);
    if (!detail) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json(detail);
  } catch (error) {
    if (error instanceof BusinessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }
}
