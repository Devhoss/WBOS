import { NextRequest, NextResponse } from "next/server";

import { TaskApplicationService } from "@/domains/tasks/services/task-application-service";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

const app = new TaskApplicationService();

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext(req.headers);
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const task = await app.completeTask(context, id, body.updatedAt);
    return NextResponse.json(task);
  } catch (error) {
    if (error instanceof BusinessError) {
      const status =
        error.code === "TASK_NOT_FOUND" ? 404 :
        error.code === "TASK_CONFLICT" || error.code === "TASK_INVALID_STATUS" || error.code === "TASK_LINES_INCOMPLETE" ? 409 :
        error.code === "MISSING_UPDATED_AT" || error.code === "INVALID_UPDATED_AT" ? 400 :
        403;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    console.error("Unexpected error completing task:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again.", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}
