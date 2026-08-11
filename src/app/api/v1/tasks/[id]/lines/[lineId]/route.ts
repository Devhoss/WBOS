import { NextRequest, NextResponse } from "next/server";

import { TaskApplicationService } from "@/domains/tasks/services/task-application-service";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { accountRateLimitOrNull } from "@/infrastructure/rate-limit/enforce";
import { BusinessError } from "@/shared/errors/business-error";

const app = new TaskApplicationService();

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; lineId: string }> },
) {
  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext(req.headers);
    const { id, lineId } = await params;

    const limited = accountRateLimitOrNull(context.userId, "task-line-update");
    if (limited) return limited;

    const body = await req.json();

    const quantity = Number(body.completedQuantity ?? body.quantity ?? 0);
    if (quantity < 0) {
      return NextResponse.json({ error: "Quantity cannot be negative", code: "INVALID_QUANTITY" }, { status: 400 });
    }

    const task = await app.updateTaskLine(context, id, lineId, quantity);
    return NextResponse.json(task);
  } catch (error) {
    if (error instanceof BusinessError) {
      const status =
        error.code === "TASK_NOT_FOUND" || error.code === "TASK_LINE_NOT_FOUND" ? 404 :
        error.code === "TASK_NOT_IN_PROGRESS" || error.code === "SHIPMENT_INVALID_STATUS" || error.code === "SHIPMENT_BARCODE_MISMATCH" ? 409 :
        error.code === "MISSING_UPDATED_AT" || error.code === "INVALID_UPDATED_AT" ? 400 :
        409;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    console.error("Unexpected error updating task line:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again.", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}
