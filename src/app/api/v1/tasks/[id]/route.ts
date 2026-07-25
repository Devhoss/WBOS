import { NextRequest, NextResponse } from "next/server";

import { TaskApplicationService } from "@/domains/tasks/services/task-application-service";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

const app = new TaskApplicationService();

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext(req.headers);
    const { id } = await params;

    const task = await app.getTask(context, id);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json(task);
  } catch (error) {
    if (error instanceof BusinessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }
}
