import { notFound } from "next/navigation";

import { InvoiceRepository } from "@/domains/sales/repositories/invoice-repository";
import { BusinessSettingsRepository } from "@/domains/settings/repositories/business-settings-repository";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";

import { PrintLayout } from "@/components/document-engine";
import { PrintableInvoice } from "@/components/invoice/printable-invoice";

export default async function InvoicePrintPage({ params }: { params: Promise<{ invId: string }> }) {
  const { invId } = await params;
  const context = await new AuthenticatedRequestContextService().getCurrentContext();

  const [invoice, settings] = await Promise.all([
    new InvoiceRepository().findById(context.organizationId, invId),
    new BusinessSettingsRepository().findByOrganizationId(context.organizationId),
  ]);

  if (!invoice || !settings) notFound();

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
      <PrintableInvoice
        branding={branding}
        invoice={{
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          status: invoice.status,
          currency: invoice.currency,
          subtotal: Number(invoice.subtotal),
          taxAmount: Number(invoice.taxAmount),
          discountAmount: Number(invoice.discountAmount),
          discountType: invoice.discountType,
          discountRate: invoice.discountRate ? Number(invoice.discountRate) : null,
          totalAmount: Number(invoice.totalAmount),
          amountPaid: Number(invoice.amountPaid),
          issuedAt: invoice.issuedAt?.toISOString() ?? null,
          dueDate: invoice.dueDate?.toISOString() ?? null,
          customerName: invoice.customerName,
          customerAddress: invoice.customerAddress,
          paymentTerms: invoice.paymentTerms,
          notes: invoice.notes,
          warehouseName: invoice.warehouseName,
          deliveryStatus: invoice.deliveryStatus,
          salesOrder: { soNumber: invoice.salesOrder.soNumber },
          lines: invoice.lines.map((l) => ({
            lineNumber: l.lineNumber,
            productName: l.productName,
            productSku: l.productSku,
            unitOfMeasureCode: l.unitOfMeasureCode,
            quantity: Number(l.quantity),
            unitPrice: Number(l.unitPrice),
            discountAmount: 0,
            totalPrice: Number(l.totalPrice),
            piecesPerBox: l.piecesPerBox ? Number(l.piecesPerBox) : null,
          })),
        }}
        showActions={false}
      />
    </PrintLayout>
  );
}
