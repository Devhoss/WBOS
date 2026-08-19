import { readFile } from "fs/promises";
import { join, resolve, sep } from "path";
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/infrastructure/database/prisma";
import { verifyDownloadToken } from "@/lib/download/signed-token";
import { isLegacyPublicPath } from "@/domains/sales/signed-invoice-storage";
import { STORAGE_ROOT } from "@/infrastructure/storage/storage-root";

const MIME_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
};

/**
 * Streams a signed proof of delivery to a browser holding only a short-lived
 * token. The token names the sales order; the file path comes from the database
 * row for that order, never from the URL, so there is nothing here to traverse.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const payload = verifyDownloadToken(token);

  if (!payload || payload.kind !== "signed-invoice") {
    return NextResponse.json({ error: "Invalid or expired download link" }, { status: 403 });
  }

  const order = await prisma.salesOrder.findFirst({
    where: {
      id: payload.invoiceId,
      organizationId: payload.organizationId,
      archivedAt: null,
    },
    select: { soNumber: true, signedInvoicePath: true },
  });

  if (!order?.signedInvoicePath) {
    return NextResponse.json({ error: "Signed invoice not found" }, { status: 404 });
  }

  // Legacy rows still point into the public directory; new ones carry the
  // storage-root path served by /api/uploads.
  const relative = isLegacyPublicPath(order.signedInvoicePath)
    ? order.signedInvoicePath.replace(/^\//, "")
    : order.signedInvoicePath.replace(/^\/api\/uploads\//, "");

  const rootResolved = resolve(STORAGE_ROOT);
  const filePath = resolve(join(rootResolved, relative));
  if (filePath !== rootResolved && !filePath.startsWith(rootResolved + sep)) {
    return NextResponse.json({ error: "Signed invoice not found" }, { status: 404 });
  }

  let buffer: Buffer;
  try {
    buffer = await readFile(filePath);
  } catch {
    return NextResponse.json({ error: "Signed invoice not found" }, { status: 404 });
  }

  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": MIME_TYPES[ext] ?? "application/octet-stream",
      "Content-Disposition": `inline; filename="signed-invoice-${order.soNumber}.${ext || "pdf"}"`,
      "Cache-Control": "no-store",
    },
  });
}
