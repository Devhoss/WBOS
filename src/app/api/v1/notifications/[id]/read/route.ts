import { NextRequest, NextResponse } from "next/server";

import { createNotificationService } from "@/domains/notifications/services/create-notification-service";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await createNotificationService().markAsRead(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
