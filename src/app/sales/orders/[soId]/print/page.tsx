import { notFound } from "next/navigation";

import { SalesOrderRepository } from "@/domains/sales/repositories/sales-order-repository";
import { BusinessSettingsRepository } from "@/domains/settings/repositories/business-settings-repository";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";

import { PrintLayout } from "@/components/document-engine";
import { DocumentProvider } from "@/components/document-engine";
import { PrintableSalesOrder } from "@/components/sales/printable-sales-order";

export default async function SalesOrderPrintPage({ params }: { params: Promise<{ soId: string }> }) {
  const { soId } = await params;
  const context = await new AuthenticatedRequestContextService().getCurrentContext();

  const [order, settings] = await Promise.all([
    new SalesOrderRepository().findById(context.organizationId, soId),
    new BusinessSettingsRepository().findByOrganizationId(context.organizationId),
  ]);

  if (!order || !settings) notFound();

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
        documentTitle={`Sales Order ${order.soNumber}`}
        documentNumber={order.soNumber}
      >
        <PrintableSalesOrder
          order={{
            soNumber: order.soNumber,
            customerName: order.customer.name,
            currency: order.currency,
            subtotal: Number(order.subtotal),
            taxAmount: Number(order.taxAmount),
            discountAmount: Number(order.discountAmount),
            totalAmount: Number(order.totalAmount),
            notes: order.notes,
            createdAt: order.createdAt.toISOString(),
            expectedShipDate: order.expectedShipDate?.toISOString() ?? null,
            deliveryAddress: order.deliveryAddress,
            lines: order.lines.map((l) => ({
              lineNumber: l.lineNumber,
              productName: l.productName,
              productArabicName: l.productArabicName ?? null,
              productSku: l.productSku,
              unitOfMeasureCode: l.unitOfMeasureCode,
              orderedQuantity: Number(l.orderedQuantity),
              shippedQuantity: Number(l.shippedQuantity),
              returnedQuantity: Number(l.returnedQuantity),
              unitPrice: Number(l.unitPrice),
              totalPrice: Number(l.totalPrice),
            })),
          }}
        />
      </DocumentProvider>
    </PrintLayout>
  );
}
