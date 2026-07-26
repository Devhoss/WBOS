import { notFound } from "next/navigation";

import { prisma } from "@/infrastructure/database/prisma";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { AppShell } from "@/components/app-shell";
import { getQuotationAction } from "@/domains/quotations/actions/get-quotation";
import { QuotationEditForm } from "./quotation-edit-form";

export default async function EditQuotationPage({ params }: { params: Promise<{ qtId: string }> }) {
  const { qtId } = await params;
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  const orgId = context.organizationId;

  const [quotation, customers, products, units] = await Promise.all([
    getQuotationAction(qtId),
    prisma.customer.findMany({
      where: { organizationId: orgId, archivedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.product.findMany({
      where: { organizationId: orgId, archivedAt: null, status: { not: "ARCHIVED" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, sku: true, barcode: true, defaultSellingPrice: true, unitOfMeasure: { select: { id: true, name: true, code: true } }, piecesPerBox: true },
    }).then((rows) => rows.map((p) => ({ ...p, defaultSellingPrice: p.defaultSellingPrice ? Number(p.defaultSellingPrice) : null, piecesPerBox: p.piecesPerBox ? Number(p.piecesPerBox) : null }))),
    prisma.unitOfMeasure.findMany({
      where: { organizationId: orgId, archivedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
    }),
  ]);

  if (!quotation) notFound();

  const serializedQuotation = {
    id: quotation.id,
    customerId: quotation.customerId,
    currency: quotation.currency,
    subtotal: Number(quotation.subtotal),
    taxAmount: Number(quotation.taxAmount),
    totalAmount: Number(quotation.totalAmount),
    discountAmount: Number(quotation.discountAmount),
    discountType: quotation.discountType,
    discountRate: quotation.discountRate ? Number(quotation.discountRate) : null,
    validUntil: quotation.validUntil ? quotation.validUntil.toISOString() : null,
    notes: quotation.notes,
    terms: quotation.terms,
    lines: quotation.lines.map((l) => ({
      id: l.id,
      productId: l.productId,
      unitOfMeasureId: l.unitOfMeasureId,
      lineNumber: l.lineNumber,
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice),
      totalPrice: Number(l.totalPrice),
      productName: l.productName,
      productSku: l.productSku,
      unitOfMeasureCode: l.unitOfMeasureCode,
      piecesPerBox: l.piecesPerBox ? Number(l.piecesPerBox) : null,
      productBarcode: l.productBarcode ?? null,
      description: l.description,
      notes: l.notes,
    })),
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Edit {quotation.qtNumber}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Update the quotation details.</p>
        </div>
        <QuotationEditForm quotation={serializedQuotation} customers={customers} products={products} unitsOfMeasure={units} />
      </div>
    </AppShell>
  );
}
