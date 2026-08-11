import { NextRequest, NextResponse } from "next/server";

import { ShipmentService } from "@/domains/sales/services/shipment-service";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { accountRateLimitOrNull } from "@/infrastructure/rate-limit/enforce";
import { BusinessError } from "@/shared/errors/business-error";

const service = new ShipmentService();

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext();
    const { id } = await params;

    const limited = accountRateLimitOrNull(context.userId, "shipment-deliver");
    if (limited) return limited;

    await service.deliver(context, id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof BusinessError) {
      const statusCode =
        error.code === "SHIPMENT_NOT_FOUND" ? 404 :
        error.code === "SHIPMENT_INVALID_STATUS" ? 409 :
        400;
      return NextResponse.json({ error: error.message, code: error.code }, { status: statusCode });
    }
    throw error;
  }
}
