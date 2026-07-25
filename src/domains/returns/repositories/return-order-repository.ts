import { Prisma, type ReturnCondition, type ReturnDisposition, type ReturnReason, type ReturnStatus } from "@prisma/client";
import { prisma } from "@/infrastructure/database/prisma";

export class ReturnOrderRepository {
  async create(
    organizationId: string,
    returnNumber: string,
    createdById: string,
    input: {
      salesOrderId?: string;
      invoiceId?: string;
      customerId: string;
      reason: string;
      notes?: string;
      lines: Array<{
        productId: string;
        unitOfMeasureId: string;
        invoiceLineId?: string;
        lineNumber: number;
        expectedQuantity: number;
        unitPrice: number;
        notes?: string;
      }>;
    },
  ) {
    return prisma.returnOrder.create({
      data: {
        organizationId,
        returnNumber,
        salesOrderId: input.salesOrderId,
        invoiceId: input.invoiceId,
        customerId: input.customerId,
        reason: input.reason as ReturnReason,
        notes: input.notes,
        createdById,
        lines: {
          create: input.lines.map((line) => ({
            organizationId,
            productId: line.productId,
            unitOfMeasureId: line.unitOfMeasureId,
            invoiceLineId: line.invoiceLineId,
            lineNumber: line.lineNumber,
            expectedQuantity: new Prisma.Decimal(line.expectedQuantity),
            unitPrice: new Prisma.Decimal(line.unitPrice),
            notes: line.notes,
          })),
        },
      },
      include: {
        lines: { orderBy: { lineNumber: "asc" } },
        customer: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        salesOrder: { select: { id: true, soNumber: true } },
        invoice: { select: { id: true, invoiceNumber: true } },
      },
    });
  }

  async findById(organizationId: string, id: string) {
    return prisma.returnOrder.findFirst({
      where: { organizationId, id },
      include: {
        lines: {
          orderBy: { lineNumber: "asc" },
          include: {
            product: { select: { id: true, name: true, sku: true } },
          },
        },
        customer: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        salesOrder: { select: { id: true, soNumber: true } },
        invoice: { select: { id: true, invoiceNumber: true } },
        creditNote: { select: { id: true, creditNoteNumber: true, status: true, totalAmount: true } },
      },
    });
  }

  async list(organizationId: string, pageSize = 50) {
    const [data, total] = await Promise.all([
      prisma.returnOrder.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        take: pageSize,
        include: {
          lines: { select: { id: true, expectedQuantity: true, receivedQuantity: true, disposition: true } },
          customer: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
          salesOrder: { select: { id: true, soNumber: true } },
          invoice: { select: { id: true, invoiceNumber: true } },
        },
      }),
      prisma.returnOrder.count({ where: { organizationId } }),
    ]);
    return { data, total };
  }

  async updateStatus(
    organizationId: string,
    id: string,
    status: string,
    extra?: Record<string, unknown>,
  ) {
    return prisma.returnOrder.updateMany({
      where: { id, organizationId },
      data: { status: status as ReturnStatus, ...extra },
    });
  }

  async updateLine(
    organizationId: string,
    lineId: string,
    data: {
      receivedQuantity?: number;
      disposition?: string;
      condition?: string;
    },
  ) {
    return prisma.returnOrderLine.update({
      where: { id: lineId },
      data: {
        receivedQuantity: data.receivedQuantity != null ? new Prisma.Decimal(data.receivedQuantity) : undefined,
        disposition: data.disposition as ReturnDisposition | undefined,
        condition: data.condition as ReturnCondition | undefined,
      },
    });
  }
}
