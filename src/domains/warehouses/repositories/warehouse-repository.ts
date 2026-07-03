import { prisma } from "@/infrastructure/database/prisma";

import type { CreateWarehouseInput } from "../validation/warehouse-schema";

export class WarehouseRepository {
  async listActive(organizationId: string) {
    return prisma.warehouse.findMany({
      where: {
        organizationId,
        archivedAt: null,
      },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });
  }

  async create(organizationId: string, input: CreateWarehouseInput) {
    return prisma.warehouse.create({
      data: {
        organizationId,
        name: input.name,
        code: input.code,
        address: input.address || null,
        isDefault: input.isDefault,
      },
    });
  }

  async clearDefault(organizationId: string) {
    return prisma.warehouse.updateMany({
      where: { organizationId, isDefault: true },
      data: { isDefault: false },
    });
  }

  async countActive(organizationId: string) {
    return prisma.warehouse.count({
      where: {
        organizationId,
        archivedAt: null,
      },
    });
  }
}
