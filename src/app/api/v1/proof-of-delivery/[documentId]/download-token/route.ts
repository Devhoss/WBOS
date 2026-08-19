import { NextRequest, NextResponse } from "next/server";

import { ProofOfDeliveryService } from "@/domains/sales/services/proof-of-delivery-service";
import { accountRateLimitOrNull } from "@/infrastructure/rate-limit/enforce";
import { apiContext } from "@/infrastructure/request/api-context";
import { generateDownloadToken } from "@/lib/download/signed-token";

/**
 * A short-lived URL for one proof-of-delivery page.
 *
 * `Linking.openURL` hands the URL to the system browser, which carries neither
 * the Bearer token nor a session cookie — so the phone asks for a token first
 * and opens that, exactly as it already does for invoice PDFs and for the
 * pre-POD signed invoice. This is the MOB-09 pattern and the reason these
 * documents can live outside the public directory at all.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const auth = await apiContext(req.headers);
  if (!auth.ok) return auth.response;

  const limited = accountRateLimitOrNull(auth.context.userId, "invoice-download-token");
  if (limited) return limited;

  const { documentId } = await params;

  const document = await new ProofOfDeliveryService().findForDownload(
    auth.context.organizationId,
    documentId,
  );

  if (!document) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  const token = generateDownloadToken(documentId, auth.context.organizationId, "pod-document");
  const baseUrl = (process.env.BETTER_AUTH_URL ?? process.env.INTERNAL_APP_URL ?? "").replace(
    /\/+$/,
    "",
  );

  return NextResponse.json({
    url: `${baseUrl}/api/proof-of-delivery/download/${token}`,
    expiresIn: 300,
  });
}
