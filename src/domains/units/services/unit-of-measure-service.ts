import { Prisma } from "@prisma/client";

import { ActivityLogRepository } from "@/domains/activity/repositories/activity-log-repository";
import type { AuthenticatedRequestContext } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { UnitOfMeasureRepository } from "../repositories/unit-of-measure-repository";
import type { CreateUnitOfMeasureInput, UpdateUnitOfMeasureInput } from "../validation/unit-of-measure-schema";

export class UnitOfMeasureService {
  constructor(
    private readonly units = new UnitOfMeasureRepository(),
    private readonly activityLogs = new ActivityLogRepository(),
  ) {}

  async listActive(context: AuthenticatedRequestContext) {
    return this.units.listActive(context.organizationId);
  }

  async listAll(context: AuthenticatedRequestContext) {
    return this.units.listAll(context.organizationId);
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

  async update(context: AuthenticatedRequestContext, input: UpdateUnitOfMeasureInput) {
    const existing = await this.units.findById(context.organizationId, input.id);

    if (!existing) {
      throw new BusinessError("Unit of measure was not found.", "UNIT_OF_MEASURE_NOT_FOUND");
    }

    if (input.isBaseUnit && !existing.isBaseUnit) {
      await this.units.clearBaseUnit(context.organizationId);
    }

    try {
      const unit = await this.units.update(context.organizationId, {
        ...input,
        conversionToBase: input.isBaseUnit ? 1 : input.conversionToBase,
      });

      await this.activityLogs.create({
        organizationId: context.organizationId,
        userId: context.userId,
        action: "UNIT_OF_MEASURE_UPDATED",
        entityType: "UnitOfMeasure",
        entityId: unit!.id,
        summary: `Unit of measure ${unit!.name} was updated.`,
        metadata: {
          code: unit!.code,
          isBaseUnit: unit!.isBaseUnit,
          conversionToBase: unit!.conversionToBase.toString(),
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

  async archive(context: AuthenticatedRequestContext, id: string) {
    const unit = await this.requireUnit(context, id);

    await this.units.archive(context.organizationId, id);
    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "UNIT_OF_MEASURE_ARCHIVED",
      entityType: "UnitOfMeasure",
      entityId: id,
      summary: `Unit of measure ${unit.name} was archived.`,
      metadata: { code: unit.code },
    });
  }

  async activate(context: AuthenticatedRequestContext, id: string) {
    const unit = await this.requireUnit(context, id);

    await this.units.activate(context.organizationId, id);
    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "UNIT_OF_MEASURE_ACTIVATED",
      entityType: "UnitOfMeasure",
      entityId: id,
      summary: `Unit of measure ${unit.name} was activated.`,
      metadata: { code: unit.code },
    });
  }

  async delete(context: AuthenticatedRequestContext, id: string) {
    const unit = await this.requireUnit(context, id);
    const productCount = await this.units.countBlockingReferences(context.organizationId, id);

    if (productCount > 0) {
      throw new BusinessError(
        "Unit cannot be deleted because it is used by active products.",
        "UNIT_OF_MEASURE_IN_USE",
      );
    }

    await this.units.delete(context.organizationId, id);
    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "UNIT_OF_MEASURE_DELETED",
      entityType: "UnitOfMeasure",
      entityId: id,
      summary: `Unit of measure ${unit.name} was deleted.`,
      metadata: { code: unit.code },
    });
  }

  private async requireUnit(context: AuthenticatedRequestContext, id: string) {
    const unit = await this.units.findById(context.organizationId, id);

    if (!unit) {
      throw new BusinessError("Unit of measure was not found.", "UNIT_OF_MEASURE_NOT_FOUND");
    }

    return unit;
  }
}
