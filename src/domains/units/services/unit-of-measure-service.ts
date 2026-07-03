import { Prisma } from "@prisma/client";

import { ActivityLogRepository } from "@/domains/activity/repositories/activity-log-repository";
import type { AuthenticatedRequestContext } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { UnitOfMeasureRepository } from "../repositories/unit-of-measure-repository";
import type { CreateUnitOfMeasureInput } from "../validation/unit-of-measure-schema";

export class UnitOfMeasureService {
  constructor(
    private readonly units = new UnitOfMeasureRepository(),
    private readonly activityLogs = new ActivityLogRepository(),
  ) {}

  async listActive(context: AuthenticatedRequestContext) {
    return this.units.listActive(context.organizationId);
  }

  async create(context: AuthenticatedRequestContext, input: CreateUnitOfMeasureInput) {
    const activeCount = await this.units.countActive(context.organizationId);
    const isBaseUnit = input.isBaseUnit || activeCount === 0;

    if (isBaseUnit) {
      await this.units.clearBaseUnit(context.organizationId);
    }

    try {
      const unit = await this.units.create(context.organizationId, {
        ...input,
        isBaseUnit,
        conversionToBase: isBaseUnit ? 1 : input.conversionToBase,
      });

      await this.activityLogs.create({
        organizationId: context.organizationId,
        userId: context.userId,
        action: "UNIT_OF_MEASURE_CREATED",
        entityType: "UnitOfMeasure",
        entityId: unit.id,
        summary: `Unit of measure ${unit.name} was created.`,
        metadata: {
          code: unit.code,
          isBaseUnit: unit.isBaseUnit,
          conversionToBase: unit.conversionToBase.toString(),
        },
      });

      return unit;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new BusinessError("A unit with this name or code already exists.", "UNIT_OF_MEASURE_EXISTS");
      }

      throw error;
    }
  }
}
