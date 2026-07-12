import { Prisma } from "@prisma/client";

import { prisma } from "@/infrastructure/database/prisma";

import type { CreateUnitOfMeasureInput, UpdateUnitOfMeasureInput } from "../validation/unit-of-measure-schema";

export class UnitOfMeasureRepository {
  async listActive(organizationId: string) {
    return prisma.unitOfMeasure.findMany({
      where: { organizationId, archivedAt: null },
      orderBy: [{ isBaseUnit: "desc" }, { name: "asc" }],
    });
  }

  async listAll(organizationId: string) {
    return prisma.unitOfMeasure.findMany({
      where: { organizationId },
      orderBy: [{ isBaseUnit: "desc" }, { name: "asc" }],
    });
  }

  async countActive(organizationId: string) {
    return prisma.unitOfMeasure.count({
      where: { organizationId, archivedAt: null },
    });
  }

  async findById(organizationId: string, id: string) {
    return prisma.unitOfMeasure.findFirst({
      where: { id, organizationId },
    });
  }

  async findActiveById(organizationId: string, id: string) {
    return prisma.unitOfMeasure.findFirst({
      where: { id, organizationId, archivedAt: null },
    });
  }

  async clearBaseUnit(organizationId: string) {
    return prisma.unitOfMeasure.updateMany({
      where: { organizationId, isBaseUnit: true },
      data: { isBaseUnit: false },
    });
  }

  async create(organizationId: string, input: CreateUnitOfMeasureInput) {
    return prisma.unitOfMeasure.create({
      data: {
        organizationId,
        name: input.name,
        code: input.code,
        description: input.description ?? null,
        isBaseUnit: input.isBaseUnit,
        conversionToBase: new Prisma.Decimal(input.conversionToBase),
      },
    });
  }

  async update(organizationId: string, input: UpdateUnitOfMeasureInput) {
    await prisma.unitOfMeasure.updateMany({
      where: { id: input.id, organizationId },
      data: {
        name: input.name,
        code: input.code,
        description: input.description ?? null,
        isBaseUnit: input.isBaseUnit,
        conversionToBase: new Prisma.Decimal(input.conversionToBase),
      },
    });

    return this.findById(organizationId, input.id);
  }

  async archive(organizationId: string, id: string) {
    return prisma.unitOfMeasure.updateMany({
      where: { id, organizationId },
      data: { archivedAt: new Date() },
    });
  }

  async activate(organizationId: string, id: string) {
    return prisma.unitOfMeasure.updateMany({
      where: { id, organizationId },
      data: { archivedAt: null },
    });
  }

  async countBlockingReferences(organizationId: string, id: string) {
    return prisma.product.count({
      where: { organizationId, unitOfMeasureId: id, archivedAt: null },
    });
  }

  async delete(organizationId: string, id: string) {
    return prisma.unitOfMeasure.deleteMany({
      where: { id, organizationId },
    });
  }
}
