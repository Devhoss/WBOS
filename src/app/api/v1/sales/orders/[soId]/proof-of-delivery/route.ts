import { NextRequest, NextResponse } from "next/server";

import { ProofOfDeliveryService } from "@/domains/sales/services/proof-of-delivery-service";
import { apiContext } from "@/infrastructure/request/api-context";
import { BusinessError } from "@/shared/errors/business-error";

/**
 * The proof-of-delivery sets for a sales order — one per delivery.
 *
 * The order is where you look the documents up; the delivery is what they
 * belong to. An order shipped twice returns two sets.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ soId: string }> },
) {
  const auth = await apiContext(req.headers);
  if (!auth.ok) return auth.response;

  const { soId } = await params;

  try {
    const view = await new ProofOfDeliveryService().listForSalesOrder(auth.context, soId);
    return NextResponse.json({ data: view });
  } catch (error) {
    if (error instanceof BusinessError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 404 });
    }
    throw error;
  }
}
