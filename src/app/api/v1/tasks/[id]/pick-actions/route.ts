import { NextRequest, NextResponse } from "next/server";

import { TaskApplicationService } from "@/domains/tasks/services/task-application-service";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { accountRateLimitOrNull } from "@/infrastructure/rate-limit/enforce";
import { BusinessError } from "@/shared/errors/business-error";

const app = new TaskApplicationService();

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext(req.headers);
    const { id } = await params;

    const limited = accountRateLimitOrNull(context.userId, "task-pick-actions");
    if (limited) return limited;

    const body = await req.json();

    const delta = Number(body.delta ?? 1);
    const scannedAt = body.scannedAt ? new Date(body.scannedAt) : null;
    if (scannedAt && isNaN(scannedAt.getTime())) {
      return NextResponse.json({ error: "Invalid scannedAt timestamp", code: "INVALID_SCANNED_AT" }, { status: 400 });
    }

    const task = await app.applyPickScanAction(context, id, {
      taskLineId: String(body.taskLineId ?? ""),
      barcode: String(body.barcode ?? ""),
      delta,
      clientEventId: String(body.clientEventId ?? ""),
      deviceId: body.deviceId ? String(body.deviceId) : null,
      scannedAt,
    });

    return NextResponse.json(task);
  } catch (error) {
    if (error instanceof BusinessError) {
      const status =
        error.code === "TASK_NOT_FOUND" || error.code === "TASK_LINE_NOT_FOUND" || error.code === "SHIPMENT_LINE_NOT_FOUND" ? 404 :
        error.code === "TASK_NOT_IN_PROGRESS" || error.code === "SHIPMENT_INVALID_STATUS" || error.code === "PICK_BARCODE_MISMATCH" || error.code === "SHIPMENT_OVER_PICK" ? 409 :
        error.code === "PICK_EVENT_ID_REQUIRED" || error.code === "PICK_BARCODE_REQUIRED" || error.code === "PICK_INVALID_DELTA" ? 400 :
        409;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    console.error("Unexpected error applying pick action:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again.", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}
