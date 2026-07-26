import { notFound } from "next/navigation";

import { InvoiceRepository } from "@/domains/sales/repositories/invoice-repository";
import { BusinessSettingsRepository } from "@/domains/settings/repositories/business-settings-repository";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { verifyDownloadToken } from "@/lib/download/signed-token";

import { PrintLayout } from "@/components/document-engine";
import { PrintableInvoice } from "@/components/invoice/printable-invoice";

export default async function InvoicePrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ invId: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { invId } = await params;
  const { token } = await searchParams;

  let organizationId: string;

  if (token) {
    const payload = verifyDownloadToken(token);
    if (!payload || payload.invoiceId !== invId) notFound();
    organizationId = payload.organizationId;
  } else {
    const context = await new AuthenticatedRequestContextService().getCurrentContext();
    organizationId = context.organizationId;
  }

  const [invoice, settings] = await Promise.all([
    new InvoiceRepository().findById(organizationId, invId),
    new BusinessSettingsRepository().findByOrganizationId(organizationId),
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
            productArabicName: l.productArabicName ?? null,
            productBarcode: l.product.barcode ?? null,
            productSku: l.product.sku,
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
