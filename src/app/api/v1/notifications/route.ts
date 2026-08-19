import { NextRequest, NextResponse } from "next/server";

import { apiContext } from "@/infrastructure/request/api-context";
import { createNotificationService } from "@/domains/notifications/services/create-notification-service";

export async function GET(req: NextRequest) {
  try {
    const auth = await apiContext(req.headers);
    if (!auth.ok) return auth.response;
    const context = auth.context;
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
