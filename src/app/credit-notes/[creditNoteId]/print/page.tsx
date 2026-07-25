import { notFound } from "next/navigation";

import { CreditNoteService } from "@/domains/credit-notes/services/credit-note-service";
import { BusinessSettingsRepository } from "@/domains/settings/repositories/business-settings-repository";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";

import { PrintLayout } from "@/components/document-engine";
import { DocumentProvider } from "@/components/document-engine";
import { PrintableCreditNote } from "@/components/credit-notes/printable-credit-note";

export default async function CreditNotePrintPage({ params }: { params: Promise<{ creditNoteId: string }> }) {
  const { creditNoteId } = await params;
  const context = await new AuthenticatedRequestContextService().getCurrentContext();

  const [creditNote, settings] = await Promise.all([
    new CreditNoteService().findById(context.organizationId, creditNoteId),
    new BusinessSettingsRepository().findByOrganizationId(context.organizationId),
  ]);

  if (!creditNote || !settings) notFound();

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
      <DocumentProvider
        branding={branding}
        documentTitle={`Credit Note ${creditNote.creditNoteNumber}`}
        documentNumber={creditNote.creditNoteNumber}
      >
        <PrintableCreditNote
          creditNote={{
            creditNoteNumber: creditNote.creditNoteNumber,
            invoiceNumber: creditNote.invoice.invoiceNumber,
            customerName: creditNote.customer.name,
            reason: creditNote.reason,
            totalAmount: Number(creditNote.totalAmount),
            createdAt: creditNote.createdAt.toISOString(),
            issuedAt: creditNote.issuedAt?.toISOString() ?? null,
            lines: creditNote.lines.map((l) => ({
              lineNumber: l.lineNumber,
              productName: l.productName,
              productSku: l.productSku,
              unitOfMeasureCode: l.unitOfMeasureCode,
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
