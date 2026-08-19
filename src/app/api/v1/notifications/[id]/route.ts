import { NextRequest, NextResponse } from "next/server";

import { apiContext } from "@/infrastructure/request/api-context";
import { accountRateLimitOrNull } from "@/infrastructure/rate-limit/enforce";
import { createNotificationService } from "@/domains/notifications/services/create-notification-service";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const auth = await apiContext(req.headers);
    if (!auth.ok) return auth.response;
    const context = auth.context;
    const limited = accountRateLimitOrNull(context.userId, "notification-delete");
    if (limited) return limited;
    const deleted = await createNotificationService().deleteById(
      context.organizationId,
      context.userId,
      id,
    );
    if (deleted === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
