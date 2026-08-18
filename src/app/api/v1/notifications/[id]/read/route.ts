import { NextRequest, NextResponse } from "next/server";

import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { accountRateLimitOrNull } from "@/infrastructure/rate-limit/enforce";
import { createNotificationService } from "@/domains/notifications/services/create-notification-service";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let context;
  try {
    context = await new AuthenticatedRequestContextService().getCurrentContext();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = accountRateLimitOrNull(context.userId, "notification-read");
  if (limited) return limited;

  // Scoped to the caller. A notification belonging to someone else — or to
  // another organization — is reported as "not found", so the endpoint cannot
  // be used to probe which notification ids exist.
  const updated = await createNotificationService().markAsRead(
    context.organizationId,
    context.userId,
    id,
  );

  if (updated === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
