import type { CreditNoteStatus, Prisma } from "@prisma/client";
import { prisma } from "@/infrastructure/database/prisma";

/** Either the shared client or an open transaction. */
type Db = Prisma.TransactionClient | typeof prisma;

export class CreditNoteRepository {
  async create(
    organizationId: string,
    creditNoteNumber: string,
    createdById: string,
    input: {
      /**
       * The authoritative credit total, derived by the caller from the lines
       * and already applied to the invoice. Passed in rather than recomputed
       * here so the amount added to `Invoice.creditedAmount` and the amount
       * stored on the credit note cannot drift apart.
       */
      totalAmount: number;
      status?: CreditNoteStatus;
      issuedAt?: Date;
      invoiceId: string;
      returnOrderId?: string;
      customerId: string;
      reason?: string;
      lines: Array<{
        invoiceLineId: string;
        productId: string;
        unitOfMeasureId: string;
        lineNumber: number;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
        productName: string;
        productArabicName: string | null;
        productSku: string;
        unitOfMeasureCode: string;
      }>;
    },
    db: Db = prisma,
  ) {
    return db.creditNote.create({
      data: {
        organizationId,
        creditNoteNumber,
        invoiceId: input.invoiceId,
        returnOrderId: input.returnOrderId,
        customerId: input.customerId,
        totalAmount: input.totalAmount,
        status: input.status ?? "DRAFT",
        issuedAt: input.issuedAt ?? null,
        reason: input.reason,
        createdById,
        lines: {
          create: input.lines.map((line) => ({
            organizationId,
            invoiceLineId: line.invoiceLineId,
            productId: line.productId,
            unitOfMeasureId: line.unitOfMeasureId,
            lineNumber: line.lineNumber,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            totalPrice: line.totalPrice,
            productName: line.productName,
            productArabicName: line.productArabicName,
            productSku: line.productSku,
            unitOfMeasureCode: line.unitOfMeasureCode,
          })),
        },
      },
      include: {
        lines: { orderBy: { lineNumber: "asc" } },
        invoice: { select: { id: true, invoiceNumber: true } },
        customer: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        returnOrder: { select: { id: true, returnNumber: true } },
      },
    });
  }

  async findById(organizationId: string, id: string) {
    return prisma.creditNote.findFirst({
      where: { organizationId, id },
      include: {
        lines: { orderBy: { lineNumber: "asc" } },
        invoice: { select: { id: true, invoiceNumber: true, status: true, totalAmount: true } },
        customer: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        returnOrder: { select: { id: true, returnNumber: true } },
      },
    });
  }

  async list(organizationId: string, pageSize = 50) {
    const [data, total] = await Promise.all([
      prisma.creditNote.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        take: pageSize,
        include: {
          invoice: { select: { id: true, invoiceNumber: true } },
          customer: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
        },
      }),
      prisma.creditNote.count({ where: { organizationId } }),
    ]);
    return { data, total };
  }

  async updateStatus(
    organizationId: string,
    id: string,
    status: string,
    extra?: Record<string, unknown>,
    db: Db = prisma,
  ) {
    return db.creditNote.updateMany({
      where: { id, organizationId },
      data: { status: status as CreditNoteStatus, ...extra },
    });
  }
}
