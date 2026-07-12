import { Prisma } from "@prisma/client";

import { prisma } from "@/infrastructure/database/prisma";

import type { CreateCycleCountInput } from "../validation/cycle-count-schema";

export class CycleCountRepository {
  async create(
    organizationId: string,
    countNumber: string,
    createdById: string,
    input: CreateCycleCountInput,
  ) {
    return prisma.cycleCount.create({
      data: {
        organizationId,
        countNumber,
        warehouseId: input.warehouseId,
        notes: input.notes,
        countedById: createdById,
        lines: {
          create: input.lines.map((line) => ({
            organizationId,
            productId: line.productId,
            expectedQty: new Prisma.Decimal(line.expectedQty),
            notes: line.notes,
          })),
        },
      },
      include: {
        warehouse: { select: { id: true, name: true, code: true } },
        lines: {
          include: {
            product: { select: { id: true, sku: true, name: true, barcode: true } },
          },
        },
      },
    });
  }

  async findById(organizationId: string, id: string) {
    return prisma.cycleCount.findFirst({
      where: { id, organizationId },
      include: {
        warehouse: true,
        countedBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
        lines: {
          include: {
            product: { select: { id: true, sku: true, name: true, barcode: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });
  }

  async listByOrganization(
    organizationId: string,
    status?: string,
    warehouseId?: string,
    page = 1,
    pageSize = 20,
  ) {
    const where: Prisma.CycleCountWhereInput = { organizationId };

    if (status) where.status = status as never;
    if (warehouseId) where.warehouseId = warehouseId;

    const [data, total] = await Promise.all([
      prisma.cycleCount.findMany({
        where,
        include: {
          warehouse: { select: { id: true, name: true, code: true } },
          countedBy: { select: { name: true } },
          _count: { select: { lines: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.cycleCount.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async updateLineQty(organizationId: string, lineId: string, countedQty: number, notes?: string) {
    const line = await prisma.cycleCountLine.findFirst({
      where: { id: lineId, organizationId },
    });

    if (!line) return null;

    const variance = countedQty - Number(line.expectedQty);

    return prisma.cycleCountLine.update({
      where: { id: lineId },
      data: {
        countedQty: new Prisma.Decimal(countedQty),
        variance: new Prisma.Decimal(variance),
        notes,
      },
    });
  }

  async updateStatus(organizationId: string, id: string, status: string, extra?: { approvedById?: string; approvedAt?: Date; countedAt?: Date }) {
    return prisma.cycleCount.updateMany({
      where: { id, organizationId },
      data: { status: status as never, ...extra },
    });
  }

  async updateCountedAt(organizationId: string, id: string, countedAt: Date) {
    return prisma.cycleCount.updateMany({
      where: { id, organizationId },
      data: { countedAt },
    });
  }

  async listLinesByCountId(organizationId: string, countId: string) {
    return prisma.cycleCountLine.findMany({
      where: { cycleCountId: countId, organizationId },
      include: {
        product: { select: { id: true, sku: true, name: true, barcode: true } },
      },
      orderBy: { createdAt: "asc" },
    });
  }
}
