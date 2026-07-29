import { Prisma, type CurrencyCode, type DiscountType, type InvoiceStatus } from "@prisma/client";

import { prisma } from "@/infrastructure/database/prisma";

type CreateInvoiceLineInput = {
  organizationId: string;
  salesOrderLineId: string;
  productId: string;
  unitOfMeasureId: string;
  lineNumber: number;
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  totalPrice: Prisma.Decimal;
  lineType: "NORMAL" | "FREE_SAMPLE";
  productName: string;
  productArabicName: string | null;
  productSku: string;
  unitOfMeasureCode: string;
  piecesPerBox: Prisma.Decimal | null;
  description: string | null | undefined;
};

type CreateInvoiceInput = {
  salesOrderId: string;
  customerId: string;
  currency: CurrencyCode;
  subtotal: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  discountType: DiscountType | null;
  discountRate: Prisma.Decimal | null;
  customerName: string;
  customerAddress: string | null;
  paymentTerms: string | null;
  dueDate: Date | null;
  notes: string | null;
  warehouseName: string | null;
  deliveryStatus: string | null;
  lines: CreateInvoiceLineInput[];
};

export class InvoiceRepository {
  async create(organizationId: string, invoiceNumber: string, data: CreateInvoiceInput) {
    return prisma.invoice.create({
      data: {
        organizationId,
        invoiceNumber,
        salesOrderId: data.salesOrderId,
        customerId: data.customerId,
        status: "ISSUED",
        currency: data.currency,
        subtotal: data.subtotal,
        taxAmount: data.taxAmount,
        totalAmount: data.totalAmount,
        discountAmount: data.discountAmount,
        discountType: data.discountType,
        discountRate: data.discountRate,
        customerName: data.customerName,
        customerAddress: data.customerAddress,
        paymentTerms: data.paymentTerms,
        dueDate: data.dueDate,
        warehouseName: data.warehouseName,
        deliveryStatus: data.deliveryStatus,
        notes: data.notes,
        issuedAt: new Date(),
        lines: { create: data.lines as any },
      },
      include: {
        lines: { orderBy: { lineNumber: "asc" } },
        customer: { select: { id: true, name: true } },
        salesOrder: { select: { id: true, soNumber: true, signedInvoicePath: true } },
      },
    });
  }

  async findById(organizationId: string, id: string) {
    return prisma.invoice.findFirst({
      where: { id, organizationId },
      include: {
        lines: {
          orderBy: { lineNumber: "asc" },
          include: { product: true, unitOfMeasure: true },
        },
        customer: true,
        salesOrder: { select: { id: true, soNumber: true, signedInvoicePath: true } },
        payments: { orderBy: { paidAt: "desc" } },
        returnOrders: {
          select: {
            id: true,
            returnNumber: true,
            status: true,
            reason: true,
            notes: true,
            createdAt: true,
            completedAt: true,
            cancelledAt: true,
            lines: {
              select: { id: true, productId: true, receivedQuantity: true, expectedQuantity: true, unitPrice: true },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        creditNotes: {
          select: {
            id: true,
            creditNoteNumber: true,
            status: true,
            totalAmount: true,
            reason: true,
            createdAt: true,
            issuedAt: true,
            cancelledAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });
  }

  async listWithFilters(
    organizationId: string,
    filters: {
      status?: InvoiceStatus;
      customerId?: string;
      search?: string;
      page?: number;
      pageSize?: number;
    } = {},
  ) {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;
    const where: Prisma.InvoiceWhereInput = { organizationId };

    if (filters.status) where.status = filters.status;
    if (filters.customerId) where.customerId = filters.customerId;

    if (filters.search) {
      where.OR = [
        { invoiceNumber: { contains: filters.search, mode: "insensitive" } },
        { customer: { name: { contains: filters.search, mode: "insensitive" } } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true } },
        salesOrder: { select: { id: true, soNumber: true, signedInvoicePath: true } },
          _count: { select: { lines: true, payments: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.invoice.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async updateStatus(organizationId: string, id: string, status: InvoiceStatus) {
    return prisma.invoice.updateMany({ where: { id, organizationId }, data: { status } });
  }

  async addAmountPaid(organizationId: string, id: string, amount: Prisma.Decimal.Value) {
    return prisma.invoice.updateMany({
      where: { id, organizationId },
      data: { amountPaid: { increment: new Prisma.Decimal(amount) } },
    });
  }

  async findBySalesOrderId(organizationId: string, salesOrderId: string) {
    return prisma.invoice.findMany({
      where: { organizationId, salesOrderId },
      include: {
        lines: true,
        payments: { select: { id: true, amount: true, paidAt: true } },
      },
    });
  }

  async findOpenByCustomer(organizationId: string, customerId: string) {
    return prisma.invoice.findMany({
      where: {
        organizationId,
        customerId,
        status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] },
      },
    });
  }
}
