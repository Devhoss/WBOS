import { notFound } from "next/navigation";

import { prisma } from "@/infrastructure/database/prisma";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessSettingsRepository } from "@/domains/settings/repositories/business-settings-repository";

import { PrintLayout, DocumentProvider } from "@/components/document-engine";
import { PrintableQuotation } from "@/components/quotations/printable-quotation";
import { PrintAutoTrigger } from "@/components/document-engine/print-auto-trigger";

export default async function QuotationPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ qtId: string }>;
  searchParams: Promise<{ download?: string }>;
}) {
  const { qtId } = await params;
  const { download } = await searchParams;
  const context = await new AuthenticatedRequestContextService().getCurrentContext();

  const [quotation, settings] = await Promise.all([
    prisma.quotation.findFirst({
      where: { id: qtId, organizationId: context.organizationId },
      include: {
        customer: true,
        lines: { orderBy: { lineNumber: "asc" } },
      },
    }),
    new BusinessSettingsRepository().findByOrganizationId(context.organizationId),
  ]);

  if (!quotation || !settings) notFound();

  const branding = {
    businessName: settings.businessName,
    arabicBusinessName: settings.arabicBusinessName,
    address: settings.address,
    phone: settings.phone,
    email: settings.email,
    website: settings.website,
    vatNumber: settings.vatNumber,
    commercialRegistration: settings.commercialRegistration,
    logoPath: settings.logoPath,
    footer: settings.footer,
    termsAndConditions: settings.termsAndConditions,
    documentLanguage: settings.documentLanguage,
  };

  return (
    <PrintLayout>
      {download ? <PrintAutoTrigger /> : null}
      <DocumentProvider
        branding={branding}
        documentTitle={`Quotation ${quotation.qtNumber}`}
        documentNumber={quotation.qtNumber}
      >
        <PrintableQuotation
          quotation={{
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
              productSku: l.productSku,
              productBarcode: l.productBarcode ?? null,
              unitOfMeasureCode: l.unitOfMeasureCode,
              piecesPerBox: l.piecesPerBox ? Number(l.piecesPerBox) : null,
              quantity: Number(l.quantity),
              unitPrice: Number(l.unitPrice),
              totalPrice: Number(l.totalPrice),
            })),
          }}
        />
      </DocumentProvider>
    </PrintLayout>
  );
}
