import { NextResponse } from "next/server";

import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { accountRateLimitOrNull } from "@/infrastructure/rate-limit/enforce";
import { createNotificationService } from "@/domains/notifications/services/create-notification-service";

export async function POST() {
  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext();
    const limited = accountRateLimitOrNull(context.userId, "notification-read-all");
    if (limited) return limited;
    const service = createNotificationService();
    await service.markAllAsRead(context.organizationId, context.userId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
