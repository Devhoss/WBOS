import type { InventoryDirection, Prisma } from "@prisma/client";

import { prisma } from "@/infrastructure/database/prisma";

type PrismaClientOrTransaction = typeof prisma | Prisma.TransactionClient;

export type CreateAdjustmentReasonInput = {
  organizationId: string;
  name: string;
  code: string;
  direction?: InventoryDirection | null;
  isSystem?: boolean;
};

export class AdjustmentReasonRepository {
  constructor(private readonly client: PrismaClientOrTransaction = prisma) {}

  async listActive(organizationId: string) {
    return this.client.adjustmentReason.findMany({
      where: {
        organizationId,
        archivedAt: null,
      },
      orderBy: { name: "asc" },
    });
  }

  async findActiveById(organizationId: string, id: string) {
    return this.client.adjustmentReason.findFirst({
      where: {
        id,
        organizationId,
        archivedAt: null,
      },
    });
  }

  async findActiveByCode(organizationId: string, code: string) {
    return this.client.adjustmentReason.findFirst({
      where: {
        organizationId,
        code,
        archivedAt: null,
      },
    });
  }

  async createMany(inputs: CreateAdjustmentReasonInput[]) {
    if (inputs.length === 0) {
      return { count: 0 };
    }

    return this.client.adjustmentReason.createMany({
      data: inputs.map((input) => ({
        organizationId: input.organizationId,
        name: input.name,
        code: input.code,
        direction: input.direction ?? null,
        isSystem: input.isSystem ?? false,
      })),
      skipDuplicates: true,
    });
  }

  async create(input: CreateAdjustmentReasonInput) {
    return this.client.adjustmentReason.create({
      data: {
        organizationId: input.organizationId,
        name: input.name,
        code: input.code,
        direction: input.direction ?? null,
        isSystem: input.isSystem ?? false,
      },
    });
  }
}
