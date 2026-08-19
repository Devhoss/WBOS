import { NextRequest, NextResponse } from "next/server";

import { getDefaultStorageProviderRegistry } from "@/domains/attachments/providers/storage-provider-registry";
import { ProofOfDeliveryService } from "@/domains/sales/services/proof-of-delivery-service";
import { verifyDownloadToken } from "@/lib/download/signed-token";

/**
 * Streams one proof-of-delivery page to a browser holding only a short-lived
 * token.
 *
 * The token names the document and the organization; the storage key comes
 * from the database row, never from the URL, so there is nothing here to
 * traverse. `kind` is checked so an invoice token cannot be replayed against
 * this endpoint.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const payload = verifyDownloadToken(token);

  if (!payload || payload.kind !== "pod-document") {
    return NextResponse.json({ error: "Invalid or expired download link" }, { status: 403 });
  }

  const document = await new ProofOfDeliveryService().findForDownload(
    payload.organizationId,
    payload.invoiceId,
  );

  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const provider = getDefaultStorageProviderRegistry().get(document.provider);
  const data = await provider.read(document.storageKey);

  if (!data) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": document.mimeType,
      "Content-Disposition": `inline; filename="${document.fileName.replace(/["\\]/g, "")}"`,
      // A customer's signed paperwork must never enter a shared cache.
      "Cache-Control": "private, no-store",
    },
  });
}
