import type { InventoryDirection, InventoryMovementType, Prisma } from "@prisma/client";

import { prisma } from "@/infrastructure/database/prisma";

type PrismaClientOrTransaction = typeof prisma | Prisma.TransactionClient;

export type CreateInventoryLedgerEntryInput = {
  organizationId: string;
  transactionId: string;
  transactionLineId: string;
  productId: string;
  warehouseId: string;
  movementType: InventoryMovementType;
  direction: InventoryDirection;
  quantity: Prisma.Decimal.Value;
  occurredAt: Date;
};

export class InventoryLedgerRepository {
  constructor(private readonly client: PrismaClientOrTransaction = prisma) {}

  async create(input: CreateInventoryLedgerEntryInput) {
    return this.client.inventoryLedgerEntry.create({
      data: input,
    });
  }

  async createMany(inputs: CreateInventoryLedgerEntryInput[]) {
    if (inputs.length === 0) {
      return { count: 0 };
    }

    return this.client.inventoryLedgerEntry.createMany({
      data: inputs,
    });
  }

  async listForProduct(organizationId: string, productId: string) {
    return this.client.inventoryLedgerEntry.findMany({
      where: {
        organizationId,
        productId,
      },
      include: {
        warehouse: true,
        transaction: true,
      },
      orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }],
    });
  }

  async aggregateByProductAndWarehouse(organizationId: string, productId?: string, warehouseId?: string) {
    return this.client.inventoryLedgerEntry.groupBy({
      by: ["productId", "warehouseId", "direction"],
      where: {
        organizationId,
        ...(productId && { productId }),
        ...(warehouseId && { warehouseId }),
      },
      _sum: {
        quantity: true,
      },
    });
  }
}
