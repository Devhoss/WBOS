import { Prisma, type ShipmentStatus } from "@prisma/client";

import { prisma } from "@/infrastructure/database/prisma";

import type { CreateShipmentInput } from "../validation/shipment-schema";

export class ShipmentRepository {
  async create(
    organizationId: string,
    shipmentNumber: string,
    createdById: string,
    input: CreateShipmentInput,
  ) {
    return prisma.shipment.create({
      data: {
        organizationId,
        shipmentNumber,
        salesOrderId: input.salesOrderId,
        warehouseId: input.warehouseId,
        notes: input.notes,
        createdById,
        lines: {
          create: input.lines.map((line) => ({
            organizationId,
            salesOrderLineId: line.salesOrderLineId,
            productId: line.productId,
            quantity: new Prisma.Decimal(line.quantity),
            productName: line.productName,
            productSku: line.productSku,
            notes: line.notes,
          })),
        },
      },
      include: {
        lines: true,
        salesOrder: true,
        warehouse: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async findById(organizationId: string, id: string) {
    return prisma.shipment.findFirst({
      where: { id, organizationId },
      include: {
        lines: {
          include: {
            product: { select: { id: true, sku: true, name: true, barcode: true } },
            salesOrderLine: { select: { orderedQuantity: true, shippedQuantity: true } },
          },
        },
        salesOrder: {
          include: {
            customer: { select: { id: true, name: true } },
          },
        },
        warehouse: true,
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async listWithFilters(
    organizationId: string,
    filters: {
      status?: ShipmentStatus;
      salesOrderId?: string;
      warehouseId?: string;
      page?: number;
      pageSize?: number;
    } = {},
  ) {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;

    const where: Prisma.ShipmentWhereInput = { organizationId };

    if (filters.status) where.status = filters.status;
    if (filters.salesOrderId) where.salesOrderId = filters.salesOrderId;
    if (filters.warehouseId) where.warehouseId = filters.warehouseId;

    const [data, total] = await Promise.all([
      prisma.shipment.findMany({
        where,
        include: {
          salesOrder: { include: { customer: { select: { name: true } } } },
          warehouse: { select: { id: true, name: true, code: true } },
          createdBy: { select: { name: true } },
          _count: { select: { lines: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.shipment.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async updateStatus(organizationId: string, id: string, status: ShipmentStatus) {
    return prisma.shipment.updateMany({ where: { id, organizationId }, data: { status } });
  }

  async incrementPickedQuantity(organizationId: string, lineId: string) {
    return prisma.shipmentLine.updateMany({
      where: { id: lineId, organizationId },
      data: {
        pickedQuantity: { increment: 1 },
        barcodeVerifiedAt: new Date(),
      },
    });
  }

  async addPickedQuantity(organizationId: string, lineId: string, quantity: number) {
    return prisma.shipmentLine.updateMany({
      where: { id: lineId, organizationId },
      data: {
        pickedQuantity: { increment: quantity },
      },
    });
  }

  async countBySalesOrder(organizationId: string, salesOrderId: string) {
    return prisma.shipment.count({
      where: { organizationId, salesOrderId, status: { notIn: ["DELIVERED", "FAILED"] } },
    });
  }
}
