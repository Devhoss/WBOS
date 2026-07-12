import { prisma } from "@/infrastructure/database/prisma";

import type { CreateWarehouseInput, UpdateWarehouseInput } from "../validation/warehouse-schema";

export class WarehouseRepository {
  async listActive(organizationId: string) {
    return prisma.warehouse.findMany({
      where: { organizationId, archivedAt: null },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });
  }

  async listAll(organizationId: string) {
    return prisma.warehouse.findMany({
      where: { organizationId },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });
  }

  async findById(organizationId: string, id: string) {
    return prisma.warehouse.findFirst({
      where: { id, organizationId },
    });
  }

  async findActiveById(organizationId: string, id: string) {
    return prisma.warehouse.findFirst({
      where: { id, organizationId, archivedAt: null },
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

  async update(organizationId: string, input: UpdateWarehouseInput) {
    await prisma.warehouse.updateMany({
      where: { id: input.id, organizationId },
      data: {
        name: input.name,
        code: input.code,
        address: input.address || null,
        isDefault: input.isDefault,
      },
    });

    return this.findById(organizationId, input.id);
  }

  async archive(organizationId: string, id: string) {
    return prisma.warehouse.updateMany({
      where: { id, organizationId },
      data: { archivedAt: new Date() },
    });
  }

  async activate(organizationId: string, id: string) {
    return prisma.warehouse.updateMany({
      where: { id, organizationId },
      data: { archivedAt: null },
    });
  }

  async countBlockingReferences(organizationId: string, id: string) {
    const [stockEntries, shipments] = await Promise.all([
      prisma.inventoryLedgerEntry.count({ where: { organizationId, warehouseId: id } }),
      prisma.shipment.count({ where: { organizationId, warehouseId: id } }),
    ]);

    return {
      total: stockEntries + shipments,
      details: { stockEntries, shipments },
    };
  }

  async delete(organizationId: string, id: string) {
    return prisma.warehouse.deleteMany({
      where: { id, organizationId },
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
      where: { organizationId, archivedAt: null },
    });
  }
}
