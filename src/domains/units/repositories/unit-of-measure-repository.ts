import { Prisma } from "@prisma/client";

import { prisma } from "@/infrastructure/database/prisma";

import type { CreateUnitOfMeasureInput } from "../validation/unit-of-measure-schema";

export class UnitOfMeasureRepository {
  async listActive(organizationId: string) {
    return prisma.unitOfMeasure.findMany({
      where: {
        organizationId,
        archivedAt: null,
      },
      orderBy: [{ isBaseUnit: "desc" }, { name: "asc" }],
    });
  }

  async countActive(organizationId: string) {
    return prisma.unitOfMeasure.count({
      where: {
        organizationId,
        archivedAt: null,
      },
    });
  }

  async clearBaseUnit(organizationId: string) {
    return prisma.unitOfMeasure.updateMany({
      where: {
        organizationId,
        isBaseUnit: true,
      },
      data: {
        isBaseUnit: false,
      },
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
}
