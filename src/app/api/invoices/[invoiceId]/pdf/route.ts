import { NextRequest, NextResponse } from "next/server";

import { InvoiceRepository } from "@/domains/sales/repositories/invoice-repository";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { generatePdfFromUrl } from "@/lib/pdf/printer";
import { BusinessError } from "@/shared/errors/business-error";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> },
) {
  const { invoiceId } = await params;

  try {
    const context =
      await new AuthenticatedRequestContextService().getCurrentContext(req.headers);

    const invoice = await new InvoiceRepository().findById(
      context.organizationId,
      invoiceId,
    );

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const internalOrigin =
      process.env.INTERNAL_APP_URL ?? "http://127.0.0.1:3000";
    const printUrl = `${internalOrigin}/invoices/${invoiceId}/print`;

    const cookies = req.cookies.getAll().map((c) => ({
      name: c.name,
      value: c.value,
    }));

    const pdfBuffer = await generatePdfFromUrl(printUrl, cookies);
    const blob = new Blob([pdfBuffer as BlobPart], { type: "application/pdf" });

    return new NextResponse(blob, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${invoice.invoiceNumber}.pdf"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("PDF generation failed:", error);
    if (error instanceof BusinessError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to generate PDF. Server-side PDF rendering is not properly configured." },
      { status: 500 },
    );
  }
}
