import { Prisma, type PurchaseOrderStatus } from "@prisma/client";

import { prisma } from "@/infrastructure/database/prisma";

import type { CreatePurchaseOrderInput, UpdatePurchaseOrderInput } from "../validation/purchase-order-schema";

export class PurchaseOrderRepository {
  async create(
    organizationId: string,
    poNumber: string,
    createdById: string,
    input: CreatePurchaseOrderInput,
  ) {
    return prisma.purchaseOrder.create({
      data: {
        organizationId,
        poNumber,
        supplierId: input.supplierId,
        currency: input.currency,
        subtotal: new Prisma.Decimal(input.subtotal),
        taxAmount: new Prisma.Decimal(input.taxAmount),
        totalAmount: new Prisma.Decimal(input.totalAmount),
        expectedDeliveryDate: input.expectedDeliveryDate,
        deliveryAddress: input.deliveryAddress,
        notes: input.notes,
        internalNotes: input.internalNotes,
        createdById,
        lines: {
          create: input.lines.map((line, index) => ({
            organizationId,
            productId: line.productId,
            unitOfMeasureId: line.unitOfMeasureId,
            lineNumber: index + 1,
            description: line.description,
            orderedQuantity: new Prisma.Decimal(line.orderedQuantity),
            unitCost: new Prisma.Decimal(line.unitCost),
            totalCost: new Prisma.Decimal(line.totalCost),
            notes: line.notes,
          })),
        },
      },
      include: {
        lines: {
          orderBy: { lineNumber: "asc" },
        },
        supplier: true,
        createdBy: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true, email: true } },
        archivedBy: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async findById(organizationId: string, id: string) {
    return prisma.purchaseOrder.findFirst({
      where: { id, organizationId },
      include: {
        lines: {
          orderBy: { lineNumber: "asc" },
          include: {
            product: true,
            unitOfMeasure: true,
          },
        },
        supplier: true,
        createdBy: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true, email: true } },
        archivedBy: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async listWithFilters(organizationId: string, filters: {
    status?: PurchaseOrderStatus;
    supplierId?: string;
    search?: string;
    dateFrom?: Date;
    dateTo?: Date;
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
    archived?: boolean;
  }) {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;
    const sortBy = filters.sortBy ?? "createdAt";
    const sortOrder = filters.sortOrder ?? "desc";

    const where: Prisma.PurchaseOrderWhereInput = { organizationId };

    if (filters.archived) {
      where.archivedAt = { not: null };
    } else {
      where.archivedAt = null;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.supplierId) {
      where.supplierId = filters.supplierId;
    }

    if (filters.search) {
      where.OR = [
        { poNumber: { contains: filters.search, mode: "insensitive" } },
        { supplier: { name: { contains: filters.search, mode: "insensitive" } } },
      ];
    }

    if (filters.dateFrom || filters.dateTo) {
      where.orderedAt = {};

      if (filters.dateFrom) {
        where.orderedAt.gte = filters.dateFrom;
      }

      if (filters.dateTo) {
        where.orderedAt.lte = filters.dateTo;
      }
    }

    const orderBy: Prisma.PurchaseOrderOrderByWithRelationInput = {};

    if (sortBy === "poNumber") {
      orderBy.poNumber = sortOrder;
    } else if (sortBy === "orderedAt") {
      orderBy.orderedAt = sortOrder;
    } else if (sortBy === "totalAmount") {
      orderBy.totalAmount = sortOrder;
    } else if (sortBy === "status") {
      orderBy.status = sortOrder;
    } else if (sortBy === "supplier") {
      orderBy.supplier = { name: sortOrder };
    } else if (sortBy === "expectedDeliveryDate") {
      orderBy.expectedDeliveryDate = sortOrder;
    } else {
      orderBy.createdAt = sortOrder;
    }

    const [data, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        include: {
          supplier: true,
          createdBy: { select: { id: true, name: true } },
          archivedBy: { select: { id: true, name: true } },
          _count: { select: { lines: true } },
        },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.purchaseOrder.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async updateStatus(organizationId: string, id: string, status: PurchaseOrderStatus) {
    return prisma.purchaseOrder.updateMany({
      where: { id, organizationId },
      data: { status },
    });
  }

  async update(organizationId: string, id: string, input: UpdatePurchaseOrderInput) {
    await prisma.purchaseOrderLine.deleteMany({
      where: { purchaseOrderId: id, organizationId },
    });

    return prisma.purchaseOrder.update({
      where: { id },
      data: {
        supplierId: input.supplierId,
        currency: input.currency,
        subtotal: new Prisma.Decimal(input.subtotal),
        taxAmount: new Prisma.Decimal(input.taxAmount),
        totalAmount: new Prisma.Decimal(input.totalAmount),
        expectedDeliveryDate: input.expectedDeliveryDate,
        deliveryAddress: input.deliveryAddress,
        notes: input.notes,
        internalNotes: input.internalNotes,
        lines: {
          create: input.lines.map((line, index) => ({
            organizationId,
            productId: line.productId,
            unitOfMeasureId: line.unitOfMeasureId,
            lineNumber: index + 1,
            description: line.description,
            orderedQuantity: new Prisma.Decimal(line.orderedQuantity),
            unitCost: new Prisma.Decimal(line.unitCost),
            totalCost: new Prisma.Decimal(line.totalCost),
            notes: line.notes,
          })),
        },
      },
      include: {
        lines: {
          orderBy: { lineNumber: "asc" },
        },
        supplier: true,
        createdBy: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async addReceivedQuantity(organizationId: string, lineId: string, quantity: Prisma.Decimal.Value) {
    return prisma.purchaseOrderLine.updateMany({
      where: { id: lineId, organizationId },
      data: {
        receivedQuantity: { increment: new Prisma.Decimal(quantity) },
      },
    });
  }

  async archive(organizationId: string, id: string, archivedById: string) {
    return prisma.purchaseOrder.updateMany({
      where: { id, organizationId },
      data: { archivedAt: new Date(), archivedById },
    });
  }

  async findLineById(organizationId: string, lineId: string) {
    return prisma.purchaseOrderLine.findFirst({
      where: { id: lineId, organizationId },
    });
  }
}
