import { prisma } from "@/infrastructure/database/prisma";
import { DocumentNumberService } from "@/domains/documents/services/document-number-service";
import { ActivityLogRepository } from "@/domains/activity/repositories/activity-log-repository";
import type { AuthenticatedRequestContext } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";
import type { CreateQuotationInput, UpdateQuotationInput } from "../validation/quotation-schema";

export class QuotationService {
  constructor(
    private readonly documents = new DocumentNumberService(),
    private readonly activityLogs = new ActivityLogRepository(),
  ) {}

  async create(context: AuthenticatedRequestContext, input: CreateQuotationInput) {
    const now = new Date();
    const { documentNumber } = await this.documents.generate({
      organizationId: context.organizationId,
      documentType: "QTN",
      year: now.getFullYear(),
      prefix: "QTN",
    });

    const products = await prisma.product.findMany({
      where: { organizationId: context.organizationId, id: { in: input.lines.map((l) => l.productId) } },
      select: { id: true, arabicName: true },
    });
    const arabicNameMap = new Map(products.map((p) => [p.id, p.arabicName]));

    const quotation = await prisma.quotation.create({
      data: {
        organizationId: context.organizationId,
        qtNumber: documentNumber,
        customerId: input.customerId,
        status: "DRAFT",
        currency: input.currency,
        subtotal: input.subtotal,
        taxAmount: input.taxAmount,
        totalAmount: input.totalAmount,
        discountAmount: input.discountAmount,
        discountType: input.discountType,
        discountRate: input.discountRate,
        issueDate: now,
        validUntil: input.validUntil,
        notes: input.notes,
        terms: input.terms,
        createdById: context.userId,
        lines: {
          create: input.lines.map((line, i) => ({
            organizationId: context.organizationId,
            productId: line.productId,
            unitOfMeasureId: line.unitOfMeasureId,
            lineNumber: i + 1,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            totalPrice: line.totalPrice,
            productName: line.productName,
            productArabicName: arabicNameMap.get(line.productId) ?? null,
            productSku: line.productSku,
            unitOfMeasureCode: line.unitOfMeasureCode,
            piecesPerBox: line.piecesPerBox,
            productBarcode: line.productBarcode,
            description: line.description,
            notes: line.notes,
          })),
        },
      },
      include: {
        customer: true,
        createdBy: { select: { name: true } },
        lines: { orderBy: { lineNumber: "asc" } },
      },
    });

    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "QUOTATION_CREATED",
      entityType: "Quotation",
      entityId: quotation.id,
      summary: `Quotation ${documentNumber} was created for ${quotation.customer.name}.`,
      metadata: {
        qtNumber: documentNumber,
        customerId: input.customerId,
        totalAmount: input.totalAmount,
        lineCount: input.lines.length,
      },
    });

    return quotation;
  }

  async update(context: AuthenticatedRequestContext, input: UpdateQuotationInput) {
    const existing = await prisma.quotation.findUnique({
      where: { id: input.id },
      select: { id: true, organizationId: true, status: true, qtNumber: true, customerId: true },
    });

    if (!existing || existing.organizationId !== context.organizationId) {
      throw new BusinessError("Quotation not found.", "NOT_FOUND");
    }

    if (existing.status !== "DRAFT") {
      throw new BusinessError("Only draft quotations can be edited.", "INVALID_STATUS");
    }

    const products = await prisma.product.findMany({
      where: { organizationId: context.organizationId, id: { in: input.lines.map((l) => l.productId) } },
      select: { id: true, arabicName: true },
    });
    const arabicNameMap = new Map(products.map((p) => [p.id, p.arabicName]));

    await prisma.quotationLine.deleteMany({ where: { quotationId: input.id } });

    const quotation = await prisma.quotation.update({
      where: { id: input.id },
      data: {
        customerId: input.customerId,
        currency: input.currency,
        subtotal: input.subtotal,
        taxAmount: input.taxAmount,
        totalAmount: input.totalAmount,
        discountAmount: input.discountAmount,
        discountType: input.discountType,
        discountRate: input.discountRate,
        validUntil: input.validUntil,
        notes: input.notes,
        terms: input.terms,
        lines: {
          create: input.lines.map((line, i) => ({
            organizationId: context.organizationId,
            productId: line.productId,
            unitOfMeasureId: line.unitOfMeasureId,
            lineNumber: i + 1,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            totalPrice: line.totalPrice,
            productName: line.productName,
            productArabicName: arabicNameMap.get(line.productId) ?? null,
            productSku: line.productSku,
            unitOfMeasureCode: line.unitOfMeasureCode,
            piecesPerBox: line.piecesPerBox,
            productBarcode: line.productBarcode,
            description: line.description,
            notes: line.notes,
          })),
        },
      },
      include: {
        customer: true,
        createdBy: { select: { name: true } },
        lines: { orderBy: { lineNumber: "asc" } },
      },
    });

    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "QUOTATION_UPDATED",
      entityType: "Quotation",
      entityId: quotation.id,
      summary: `Quotation ${quotation.qtNumber} was updated.`,
      metadata: { qtNumber: quotation.qtNumber, totalAmount: input.totalAmount },
    });

    return quotation;
  }

  async cancel(context: AuthenticatedRequestContext, id: string) {
    const existing = await prisma.quotation.findUnique({
      where: { id },
      select: { id: true, organizationId: true, status: true, qtNumber: true },
    });

    if (!existing || existing.organizationId !== context.organizationId) {
      throw new BusinessError("Quotation not found.", "NOT_FOUND");
    }

    if (existing.status === "CANCELLED") {
      throw new BusinessError("Quotation is already cancelled.", "INVALID_STATUS");
    }

    const quotation = await prisma.quotation.update({
      where: { id },
      data: { status: "CANCELLED", cancelledById: context.userId, cancelledAt: new Date() },
      include: {
        customer: true,
        createdBy: { select: { name: true } },
        lines: { orderBy: { lineNumber: "asc" } },
      },
    });

    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "QUOTATION_CANCELLED",
      entityType: "Quotation",
      entityId: quotation.id,
      summary: `Quotation ${quotation.qtNumber} was cancelled.`,
      metadata: { qtNumber: quotation.qtNumber },
    });

    return quotation;
  }

  async markSent(context: AuthenticatedRequestContext, id: string) {
    const existing = await prisma.quotation.findUnique({
      where: { id },
      select: { id: true, organizationId: true, status: true, qtNumber: true },
    });

    if (!existing || existing.organizationId !== context.organizationId) {
      throw new BusinessError("Quotation not found.", "NOT_FOUND");
    }

    if (existing.status !== "DRAFT") {
      throw new BusinessError("Only draft quotations can be marked as sent.", "INVALID_STATUS");
    }

    const quotation = await prisma.quotation.update({
      where: { id },
      data: { status: "SENT" },
      include: {
        customer: true,
        createdBy: { select: { name: true } },
        lines: { orderBy: { lineNumber: "asc" } },
      },
    });

    return quotation;
  }
}
