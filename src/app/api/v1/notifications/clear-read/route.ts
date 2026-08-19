import { NextRequest, NextResponse } from "next/server";

import { apiContext } from "@/infrastructure/request/api-context";
import { accountRateLimitOrNull } from "@/infrastructure/rate-limit/enforce";
import { createNotificationService } from "@/domains/notifications/services/create-notification-service";

export async function POST(req: NextRequest) {
  try {
    const auth = await apiContext(req.headers);
    if (!auth.ok) return auth.response;
    const context = auth.context;
    const limited = accountRateLimitOrNull(context.userId, "notification-clear-read");
    if (limited) return limited;
    await createNotificationService().clearRead(context.organizationId, context.userId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
