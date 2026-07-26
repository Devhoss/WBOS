import { Prisma } from "@prisma/client";
import { prisma } from "@/infrastructure/database/prisma";
import { BusinessError } from "@/shared/errors/business-error";
import { DocumentNumberService } from "@/domains/documents/services/document-number-service";
import { CreditNoteRepository } from "../repositories/credit-note-repository";
import { ActivityLogRepository } from "@/domains/activity/repositories/activity-log-repository";
import type { IssueCreditNoteInput } from "../validation/credit-note-schema";

export class CreditNoteService {
  private repo = new CreditNoteRepository();
  private docs = new DocumentNumberService();
  private logs = new ActivityLogRepository();

  async issue(context: { organizationId: string; userId: string }, input: IssueCreditNoteInput) {
    const now = new Date();
    const { documentNumber } = await this.docs.generate({
      organizationId: context.organizationId,
      documentType: "CN",
      year: now.getFullYear(),
      prefix: "CN",
    });

    const products = await prisma.product.findMany({
      where: { organizationId: context.organizationId, id: { in: input.lines.map((l) => l.productId) } },
      select: { id: true, arabicName: true },
    });
    const arabicNameMap = new Map(products.map((p) => [p.id, p.arabicName]));

    const creditNote = await this.repo.create(context.organizationId, documentNumber, context.userId, {
      ...input,
      lines: input.lines.map((line, index) => ({
        ...line,
        productArabicName: arabicNameMap.get(line.productId) ?? null,
        lineNumber: index + 1,
      })),
    });

    await this.repo.updateStatus(context.organizationId, creditNote.id, "ISSUED", {
      issuedAt: now,
    });

    await this.updateInvoiceCreditedAmount(context.organizationId, input.invoiceId);

    await this.logs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "CREDIT_NOTE_ISSUED",
      entityType: "CreditNote",
      entityId: creditNote.id,
      summary: `Credit note ${documentNumber} was issued for invoice ${creditNote.invoice.invoiceNumber}.`,
      metadata: { creditNoteNumber: documentNumber, invoiceId: input.invoiceId },
    });

    await this.logs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "CREDIT_NOTE_ISSUED",
      entityType: "Invoice",
      entityId: input.invoiceId,
      summary: `Credit note ${documentNumber} was issued for this invoice.`,
      metadata: { creditNoteNumber: documentNumber },
    });

    const cnInvoice = await prisma.invoice.findFirst({
      where: { id: input.invoiceId, organizationId: context.organizationId },
      select: { salesOrder: { select: { id: true } } },
    });
    if (cnInvoice?.salesOrder?.id) {
      await this.logs.create({
        organizationId: context.organizationId,
        userId: context.userId,
        action: "CREDIT_NOTE_ISSUED",
        entityType: "SalesOrder",
        entityId: cnInvoice.salesOrder.id,
        summary: `Credit note ${documentNumber} was issued for invoice ${creditNote.invoice.invoiceNumber}.`,
        metadata: { creditNoteNumber: documentNumber },
      });
    }

    if (input.returnOrderId) {
      await this.logs.create({
        organizationId: context.organizationId,
        userId: context.userId,
        action: "CREDIT_NOTE_ISSUED",
        entityType: "ReturnOrder",
        entityId: input.returnOrderId,
        summary: `Credit note ${documentNumber} was issued for this return.`,
        metadata: { creditNoteNumber: documentNumber },
      });
    }

    return this.repo.findById(context.organizationId, creditNote.id);
  }

  private async updateInvoiceCreditedAmount(organizationId: string, invoiceId: string) {
    const aggregates = await prisma.creditNote.aggregate({
      where: {
        organizationId,
        invoiceId,
        status: "ISSUED",
      },
      _sum: { totalAmount: true },
    });

    const creditedAmount = aggregates._sum.totalAmount ?? 0;

    const invoice = await prisma.invoice.update({
      where: { id: invoiceId, organizationId },
      data: { creditedAmount },
    });

    if (creditedAmount >= invoice.totalAmount) {
      await prisma.invoice.update({
        where: { id: invoiceId, organizationId },
        data: { status: "CREDITED" },
      });
    }
  }

  async cancel(
    context: { organizationId: string; userId: string },
    id: string,
    reason?: string,
  ) {
    const creditNote = await this.repo.findById(context.organizationId, id);

    if (!creditNote) {
      throw new BusinessError("Credit note was not found.", "CREDIT_NOTE_NOT_FOUND");
    }

    if (creditNote.status !== "ISSUED") {
      throw new BusinessError("Only issued credit notes can be cancelled.", "CREDIT_NOTE_INVALID_STATUS");
    }

    await this.repo.updateStatus(context.organizationId, id, "CANCELLED", {
      cancelledAt: new Date(),
      cancelledReason: reason,
    });

    await this.updateInvoiceCreditedAmount(context.organizationId, creditNote.invoiceId);

    await this.logs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "CREDIT_NOTE_CANCELLED",
      entityType: "CreditNote",
      entityId: id,
      summary: `Credit note ${creditNote.creditNoteNumber} was cancelled.`,
      metadata: { creditNoteNumber: creditNote.creditNoteNumber, reason },
    });
  }

  async list(organizationId: string, pageSize = 50) {
    return this.repo.list(organizationId, pageSize);
  }

  async findById(organizationId: string, id: string) {
    return this.repo.findById(organizationId, id);
  }

  async issueFromReturn(
    context: { organizationId: string; userId: string },
    returnOrder: {
      id: string;
      returnNumber: string;
      customerId: string;
      invoice: { id: string } | null;
      lines: Array<{
        id: string;
        productId: string;
        unitOfMeasureId: string;
        invoiceLineId: string | null;
        receivedQuantity: number | Prisma.Decimal;
        unitPrice: number | Prisma.Decimal;
        disposition: string | null;
      }>;
    },
  ) {
    const invoice = returnOrder.invoice;
    if (!invoice) {
      throw new BusinessError(
        "Cannot issue credit note: Return is not linked to an invoice.",
        "RETURN_NO_INVOICE",
      );
    }

    const restockLines = returnOrder.lines
      .filter((l) => l.disposition === "RESTOCK" || l.disposition === "SCRAP");

    if (restockLines.length === 0) return null;

    const productIds = [...new Set(restockLines.map((l) => l.productId))];
    const uomIds = [...new Set(restockLines.map((l) => l.unitOfMeasureId))];

    const [invoiceLines, products, unitsOfMeasure] = await Promise.all([
      prisma.invoiceLine.findMany({
        where: { invoiceId: invoice.id, organizationId: context.organizationId },
        select: { id: true, productId: true },
      }),
      prisma.product.findMany({
        where: { organizationId: context.organizationId, id: { in: productIds } },
        select: { id: true, name: true, arabicName: true, sku: true },
      }),
      prisma.unitOfMeasure.findMany({
        where: { id: { in: uomIds } },
        select: { id: true, code: true },
      }),
    ]);

    const invoiceLineByProduct = new Map(invoiceLines.map((il) => [il.productId, il.id]));
    const productMap = new Map(products.map((p) => [p.id, p]));
    const uomMap = new Map(unitsOfMeasure.map((u) => [u.id, u]));

    const lines = restockLines.map((l) => {
      const product = productMap.get(l.productId);
      const uom = uomMap.get(l.unitOfMeasureId);
      const resolvedInvoiceLineId = invoiceLineByProduct.get(l.productId) ?? l.invoiceLineId;
      return {
        invoiceLineId: resolvedInvoiceLineId ?? "",
        productId: l.productId,
        unitOfMeasureId: l.unitOfMeasureId,
        quantity: Number(l.receivedQuantity),
        unitPrice: Number(l.unitPrice),
        totalPrice: Number(l.unitPrice) * Number(l.receivedQuantity),
        productName: product?.name ?? "",
        productArabicName: product?.arabicName ?? null,
        productSku: product?.sku ?? "",
        unitOfMeasureCode: uom?.code ?? "",
      };
    });

    return this.issue(context, {
      invoiceId: invoice.id,
      returnOrderId: returnOrder.id,
      customerId: returnOrder.customerId,
      reason: `Credit from return ${returnOrder.returnNumber}`,
      lines,
    });
  }
}
