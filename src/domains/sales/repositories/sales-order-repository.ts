import { Prisma, type SalesOrderStatus } from "@prisma/client";

import { prisma } from "@/infrastructure/database/prisma";

import type { CreateSalesOrderInput, UpdateSalesOrderInput } from "../validation/sales-order-schema";

export class SalesOrderRepository {
  async create(
    organizationId: string,
    soNumber: string,
    createdById: string,
    input: CreateSalesOrderInput,
  ) {
    return prisma.salesOrder.create({
      data: {
        organizationId,
        soNumber,
        customerId: input.customerId,
        currency: input.currency,
        subtotal: new Prisma.Decimal(input.subtotal),
        taxAmount: new Prisma.Decimal(input.taxAmount),
        totalAmount: new Prisma.Decimal(input.totalAmount),
        discountAmount: new Prisma.Decimal(input.discountAmount),
        discountType: input.discountType,
        discountRate: input.discountRate != null ? new Prisma.Decimal(input.discountRate) : null,
        expectedShipDate: input.expectedShipDate,
        deliveryAddress: input.deliveryAddress,
        notes: input.notes,
        internalNotes: input.internalNotes,
        customerReference: input.customerReference,
        createdById,
        lines: {
          create: input.lines.map((line, index) => ({
            organizationId,
            productId: line.productId,
            unitOfMeasureId: line.unitOfMeasureId,
            lineNumber: index + 1,
            orderedQuantity: new Prisma.Decimal(line.orderedQuantity),
            unitPrice: new Prisma.Decimal(line.unitPrice),
            totalPrice: new Prisma.Decimal(line.totalPrice),
            productName: line.productName,
            productSku: line.productSku,
            unitOfMeasureCode: line.unitOfMeasureCode,
            piecesPerBox: line.piecesPerBox != null ? new Prisma.Decimal(line.piecesPerBox) : null,
            description: line.description,
            notes: line.notes,
          })),
        },
      },
      include: {
        lines: { orderBy: { lineNumber: "asc" } },
        customer: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true, email: true } },
        archivedBy: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async findById(organizationId: string, id: string) {
    return prisma.salesOrder.findFirst({
      where: { id, organizationId },
      include: {
        lines: {
          orderBy: { lineNumber: "asc" },
          include: { product: true, unitOfMeasure: true },
        },
        customer: true,
        createdBy: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true, email: true } },
        archivedBy: { select: { id: true, name: true, email: true } },
        shipments: {
          include: {
            lines: true,
            warehouse: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        invoices: {
          include: { lines: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });
  }

  async listWithFilters(
    organizationId: string,
    filters: {
      status?: SalesOrderStatus;
      customerId?: string;
      search?: string;
      dateFrom?: Date;
      dateTo?: Date;
      page?: number;
      pageSize?: number;
      sortBy?: string;
      sortOrder?: "asc" | "desc";
      archived?: boolean;
    } = {},
  ) {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;
    const sortBy = filters.sortBy ?? "orderedAt";
    const sortOrder = filters.sortOrder ?? "desc";

    const where: Prisma.SalesOrderWhereInput = { organizationId };

    if (filters.archived) {
      where.archivedAt = { not: null };
    } else {
      where.archivedAt = null;
    }

    if (filters.status) where.status = filters.status;
    if (filters.customerId) where.customerId = filters.customerId;

    if (filters.search) {
      where.OR = [
        { soNumber: { contains: filters.search, mode: "insensitive" } },
        { customer: { name: { contains: filters.search, mode: "insensitive" } } },
      ];
    }

    if (filters.dateFrom || filters.dateTo) {
      where.orderedAt = {};
      if (filters.dateFrom) where.orderedAt.gte = filters.dateFrom;
      if (filters.dateTo) where.orderedAt.lte = filters.dateTo;
    }

    const orderBy: Prisma.SalesOrderOrderByWithRelationInput = {};
    if (sortBy === "soNumber") orderBy.soNumber = sortOrder;
    else if (sortBy === "orderedAt") orderBy.orderedAt = sortOrder;
    else if (sortBy === "totalAmount") orderBy.totalAmount = sortOrder;
    else if (sortBy === "status") orderBy.status = sortOrder;
    else if (sortBy === "customer") orderBy.customer = { name: sortOrder };
    else orderBy.createdAt = sortOrder;

    const [data, total] = await Promise.all([
      prisma.salesOrder.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
          _count: { select: { lines: true, shipments: true, invoices: true } },
        },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.salesOrder.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async updateStatus(organizationId: string, id: string, status: SalesOrderStatus) {
    return prisma.salesOrder.updateMany({ where: { id, organizationId }, data: { status } });
  }

  async update(
    organizationId: string,
    id: string,
    input: UpdateSalesOrderInput,
  ) {
    await prisma.salesOrderLine.deleteMany({ where: { salesOrderId: id, organizationId } });

    return prisma.salesOrder.update({
      where: { id },
      data: {
        customerId: input.customerId,
        currency: input.currency,
        subtotal: new Prisma.Decimal(input.subtotal),
        taxAmount: new Prisma.Decimal(input.taxAmount),
        totalAmount: new Prisma.Decimal(input.totalAmount),
        discountAmount: new Prisma.Decimal(input.discountAmount),
        discountType: input.discountType,
        discountRate: input.discountRate != null ? new Prisma.Decimal(input.discountRate) : null,
        expectedShipDate: input.expectedShipDate,
        deliveryAddress: input.deliveryAddress,
        notes: input.notes,
        internalNotes: input.internalNotes,
        customerReference: input.customerReference,
        lines: {
          create: input.lines.map((line, index) => ({
            organizationId,
            productId: line.productId,
            unitOfMeasureId: line.unitOfMeasureId,
            lineNumber: index + 1,
            orderedQuantity: new Prisma.Decimal(line.orderedQuantity),
            unitPrice: new Prisma.Decimal(line.unitPrice),
            totalPrice: new Prisma.Decimal(line.totalPrice),
            productName: line.productName,
            productSku: line.productSku,
            unitOfMeasureCode: line.unitOfMeasureCode,
            piecesPerBox: line.piecesPerBox != null ? new Prisma.Decimal(line.piecesPerBox) : null,
            description: line.description,
            notes: line.notes,
          })),
        },
      },
      include: {
        lines: { orderBy: { lineNumber: "asc" } },
        customer: true,
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async archive(organizationId: string, id: string, archivedById: string) {
    return prisma.salesOrder.updateMany({
      where: { id, organizationId },
      data: { archivedAt: new Date(), archivedById },
    });
  }

  async addShippedQuantity(organizationId: string, lineId: string, quantity: Prisma.Decimal.Value) {
    await prisma.salesOrderLine.updateMany({
      where: { id: lineId, organizationId },
      data: { shippedQuantity: { increment: new Prisma.Decimal(quantity) } },
    });
  }
}
