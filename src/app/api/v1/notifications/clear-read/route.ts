import { NextResponse } from "next/server";

import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { createNotificationService } from "@/domains/notifications/services/create-notification-service";

export async function POST() {
  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext();
    await createNotificationService().clearRead(context.organizationId, context.userId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
