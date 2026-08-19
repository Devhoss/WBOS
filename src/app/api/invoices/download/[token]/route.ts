import { NextRequest, NextResponse } from "next/server";

import { InvoiceRepository } from "@/domains/sales/repositories/invoice-repository";
import { verifyDownloadToken } from "@/lib/download/signed-token";
import { generatePdfFromUrl } from "@/lib/pdf/printer";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const payload = verifyDownloadToken(token);

    if (!payload || payload.kind !== "invoice") {
      return NextResponse.json({ error: "Invalid or expired download link" }, { status: 403 });
    }

    const invoice = await new InvoiceRepository().findById(payload.organizationId, payload.invoiceId);

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const origin = new URL(req.url).origin;
    const printUrl = `${origin}/invoices/${payload.invoiceId}/print?token=${token}`;

    const pdfBuffer = await generatePdfFromUrl(printUrl);
    const blob = new Blob([pdfBuffer as BlobPart], { type: "application/pdf" });

    return new NextResponse(blob, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${invoice.invoiceNumber}.pdf"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("Signed PDF download failed:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF." },
      { status: 500 },
    );
  }
}
