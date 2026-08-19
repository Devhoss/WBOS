import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/infrastructure/database/prisma";
import { apiContext } from "@/infrastructure/request/api-context";
import { accountRateLimitOrNull } from "@/infrastructure/rate-limit/enforce";
import { generateDownloadToken } from "@/lib/download/signed-token";

/**
 * A short-lived URL for a signed proof of delivery.
 *
 * The mobile app opens these with `Linking.openURL`, which hands the URL to the
 * system browser — a browser holding no Bearer token and no session cookie.
 * That only worked while the documents were served from the public directory
 * with no authentication at all. Now that they are behind the uploads route,
 * the phone asks for a token first, exactly as it already does for invoice PDFs.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ soId: string }> },
) {
  const { soId } = await params;
  const auth = await apiContext(req.headers);
  if (!auth.ok) return auth.response;
  const context = auth.context;

  const limited = accountRateLimitOrNull(context.userId, "invoice-download-token");
  if (limited) return limited;

  const order = await prisma.salesOrder.findFirst({
    where: { id: soId, organizationId: context.organizationId, archivedAt: null },
    select: { signedInvoicePath: true },
  });

  if (!order?.signedInvoicePath) {
    return NextResponse.json({ error: "No signed invoice for this order." }, { status: 404 });
  }

  const token = generateDownloadToken(soId, context.organizationId, "signed-invoice");
  const baseUrl = (process.env.BETTER_AUTH_URL ?? process.env.INTERNAL_APP_URL ?? "").replace(/\/+$/, "");

  return NextResponse.json({
    url: `${baseUrl}/api/sales/signed-invoice/download/${token}`,
    expiresIn: 300,
  });
}
