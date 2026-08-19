import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/infrastructure/database/prisma";
import { apiContext } from "@/infrastructure/request/api-context";
import { BusinessSettingsRepository } from "@/domains/settings/repositories/business-settings-repository";
import { generatePdfFromHtml } from "@/lib/pdf/printer";
import { quotationPdfHtml } from "@/lib/pdf/quotation-pdf-html";
import { BusinessError } from "@/shared/errors/business-error";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ qtId: string }> },
) {
  const { qtId } = await params;

  try {
    const auth = await apiContext(req.headers);
    if (!auth.ok) return auth.response;
    const context = auth.context;
    const [quotation, settings] = await Promise.all([
      prisma.quotation.findFirst({
        where: { id: qtId, organizationId: context.organizationId },
        include: {
          customer: { select: { name: true } },
          lines: { orderBy: { lineNumber: "asc" } },
        },
      }),
      new BusinessSettingsRepository().findByOrganizationId(context.organizationId),
    ]);

    if (!quotation || !settings) {
      return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
    }

    const html = quotationPdfHtml({
      qtNumber: quotation.qtNumber,
      customerName: quotation.customer.name,
      currency: quotation.currency,
      subtotal: Number(quotation.subtotal),
      taxAmount: Number(quotation.taxAmount),
      discountAmount: Number(quotation.discountAmount),
      totalAmount: Number(quotation.totalAmount),
      notes: quotation.notes,
      terms: quotation.terms,
      issueDate: quotation.issueDate.toISOString(),
      validUntil: quotation.validUntil?.toISOString() ?? null,
      lines: quotation.lines.map((l) => ({
        lineNumber: l.lineNumber,
        productName: l.productName,
        productArabicName: l.productArabicName ?? null,
        productBarcode: l.productBarcode ?? null,
        unitOfMeasureCode: l.unitOfMeasureCode,
        piecesPerBox: l.piecesPerBox ? Number(l.piecesPerBox) : null,
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice),
        totalPrice: Number(l.totalPrice),
      })),
      businessName: settings.businessName,
      arabicBusinessName: settings.arabicBusinessName,
      address: settings.address,
      phone: settings.phone,
      email: settings.email,
      logoPath: settings.logoPath,
    });

    const pdfBuffer = await generatePdfFromHtml(html);
    const blob = new Blob([pdfBuffer as BlobPart], { type: "application/pdf" });

    return new NextResponse(blob, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${quotation.qtNumber}.pdf"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("Quotation PDF generation failed:", error);
    if (error instanceof BusinessError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to generate PDF." },
      { status: 500 },
    );
  }
}
