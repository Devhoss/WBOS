import type { InventoryMovementType, Prisma } from "@prisma/client";

import { prisma } from "@/infrastructure/database/prisma";

type PrismaClientOrTransaction = typeof prisma | Prisma.TransactionClient;

export type CreateInventoryTransactionInput = {
  organizationId: string;
  type: InventoryMovementType;
  documentNumber?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
  occurredAt: Date;
  postedAt?: Date;
  createdById?: string | null;
  notes?: string | null;
};

export type CreateInventoryTransactionLineInput = {
  organizationId: string;
  transactionId: string;
  productId: string;
  unitOfMeasureId: string;
  quantity: Prisma.Decimal.Value;
  fromWarehouseId?: string | null;
  toWarehouseId?: string | null;
  adjustmentReasonId?: string | null;
  notes?: string | null;
};

export class InventoryTransactionRepository {
  constructor(private readonly client: PrismaClientOrTransaction = prisma) {}

  async create(input: CreateInventoryTransactionInput) {
    return this.client.inventoryTransaction.create({
      data: {
        organizationId: input.organizationId,
        type: input.type,
        documentNumber: input.documentNumber ?? null,
        referenceType: input.referenceType ?? null,
        referenceId: input.referenceId ?? null,
        occurredAt: input.occurredAt,
        postedAt: input.postedAt ?? new Date(),
        createdById: input.createdById ?? null,
        notes: input.notes ?? null,
      },
    });
  }

  async createLine(input: CreateInventoryTransactionLineInput) {
    return this.client.inventoryTransactionLine.create({
      data: {
        organizationId: input.organizationId,
        transactionId: input.transactionId,
        productId: input.productId,
        unitOfMeasureId: input.unitOfMeasureId,
        quantity: input.quantity,
        fromWarehouseId: input.fromWarehouseId ?? null,
        toWarehouseId: input.toWarehouseId ?? null,
        adjustmentReasonId: input.adjustmentReasonId ?? null,
        notes: input.notes ?? null,
      },
    });
  }

  async findById(organizationId: string, id: string) {
    return this.client.inventoryTransaction.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        lines: {
          include: {
            product: true,
            unitOfMeasure: true,
            fromWarehouse: true,
            toWarehouse: true,
            adjustmentReason: true,
            ledgerEntries: true,
          },
        },
      },
    });
  }

  async listRecent(organizationId: string, take = 50) {
    return this.client.inventoryTransaction.findMany({
      where: { organizationId },
      include: {
        lines: true,
      },
      orderBy: { occurredAt: "desc" },
      take,
    });
  }

  async listWithFilters(
    organizationId: string,
    filters: {
      types?: InventoryMovementType[];
      fromDate?: Date;
      toDate?: Date;
      productId?: string;
      warehouseId?: string;
      skip?: number;
      take?: number;
    } = {},
  ) {
    const where: Prisma.InventoryTransactionWhereInput = { organizationId };

    if (filters.types && filters.types.length > 0) {
      where.type = { in: filters.types };
    }

    if (filters.fromDate || filters.toDate) {
      where.occurredAt = {};

      if (filters.fromDate) {
        where.occurredAt.gte = filters.fromDate;
      }

      if (filters.toDate) {
        where.occurredAt.lte = filters.toDate;
      }
    }

    if (filters.productId) {
      where.lines = { some: { productId: filters.productId } };
    }

    if (filters.warehouseId) {
      where.lines = {
        ...(where.lines as Prisma.InventoryTransactionLineListRelationFilter | undefined),
        some: {
          OR: [
            { fromWarehouseId: filters.warehouseId },
            { toWarehouseId: filters.warehouseId },
          ],
        },
      };
    }

    const [items, total] = await Promise.all([
      this.client.inventoryTransaction.findMany({
        where,
        include: {
          createdBy: { select: { name: true, email: true } },
          lines: {
            include: {
              product: { select: { id: true, sku: true, name: true } },
              fromWarehouse: { select: { id: true, name: true, code: true } },
              toWarehouse: { select: { id: true, name: true, code: true } },
              adjustmentReason: { select: { id: true, code: true, name: true } },
            },
          },
        },
        orderBy: { occurredAt: "desc" },
        skip: filters.skip ?? 0,
        take: filters.take ?? 50,
      }),
      this.client.inventoryTransaction.count({ where }),
    ]);

    return { items, total };
  }
}
