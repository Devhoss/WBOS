import { NextRequest, NextResponse } from "next/server";

import { TaskApplicationService } from "@/domains/tasks/services/task-application-service";
import { apiContext } from "@/infrastructure/request/api-context";
import { BusinessError } from "@/shared/errors/business-error";

const app = new TaskApplicationService();

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await apiContext(req.headers);
    if (!auth.ok) return auth.response;
    const context = auth.context;
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
