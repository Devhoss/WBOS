import { NextRequest, NextResponse } from "next/server";

import { ProofOfDeliveryService } from "@/domains/sales/services/proof-of-delivery-service";
import { accountRateLimitOrNull } from "@/infrastructure/rate-limit/enforce";
import { apiContext } from "@/infrastructure/request/api-context";
import { BusinessError } from "@/shared/errors/business-error";

/**
 * Remove one page from a delivery's proof of delivery.
 *
 * The document is resolved inside the caller's organization, so an id from
 * another tenant is reported as missing rather than refused.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const auth = await apiContext(req.headers);
  if (!auth.ok) return auth.response;

  const limited = accountRateLimitOrNull(auth.context.userId, "pod-mutate");
  if (limited) return limited;

  const { documentId } = await params;

  try {
    await new ProofOfDeliveryService().remove(auth.context, documentId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof BusinessError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 404 });
    }
    throw error;
  }
}
