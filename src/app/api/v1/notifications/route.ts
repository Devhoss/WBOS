import { NextResponse } from "next/server";

import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { createNotificationService } from "@/domains/notifications/services/create-notification-service";

export async function GET() {
  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext();
    const service = createNotificationService();

    const [notifications, unreadCount] = await Promise.all([
      service.listByUser(context.organizationId, context.userId),
      service.countUnread(context.organizationId, context.userId),
    ]);

    return NextResponse.json({ notifications, unreadCount });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
