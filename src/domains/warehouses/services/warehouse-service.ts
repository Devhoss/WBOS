import { BusinessError } from "@/shared/errors/business-error";

import { ActivityLogRepository } from "@/domains/activity/repositories/activity-log-repository";
import type { AuthenticatedRequestContext } from "@/infrastructure/request/authenticated-request-context";

import { WarehouseRepository } from "../repositories/warehouse-repository";
import type { CreateWarehouseInput, UpdateWarehouseInput } from "../validation/warehouse-schema";

export class WarehouseService {
  constructor(
    private readonly warehouses = new WarehouseRepository(),
    private readonly activityLogs = new ActivityLogRepository(),
  ) {}

  async listActive(context: AuthenticatedRequestContext) {
    return this.warehouses.listActive(context.organizationId);
  }

  async listAll(context: AuthenticatedRequestContext) {
    return this.warehouses.listAll(context.organizationId);
  }

  async create(context: AuthenticatedRequestContext, input: CreateWarehouseInput) {
    const activeCount = await this.warehouses.countActive(context.organizationId);

    if (input.isDefault || activeCount === 0) {
      await this.warehouses.clearDefault(context.organizationId);
    }

    try {
      const warehouse = await this.warehouses.create(context.organizationId, {
        ...input,
        isDefault: input.isDefault || activeCount === 0,
      });

      await this.activityLogs.create({
        organizationId: context.organizationId,
        userId: context.userId,
        action: "WAREHOUSE_CREATED",
        entityType: "Warehouse",
        entityId: warehouse.id,
        summary: `Warehouse ${warehouse.name} was created.`,
        metadata: { code: warehouse.code, isDefault: warehouse.isDefault },
      });

      return warehouse;
    } catch (error) {
      if (error instanceof Error && error.message.includes("Unique constraint failed")) {
        throw new BusinessError("A warehouse with this code already exists.", "WAREHOUSE_CODE_EXISTS");
      }

      throw error;
    }
  }

  async update(context: AuthenticatedRequestContext, input: UpdateWarehouseInput) {
    const existing = await this.warehouses.findById(context.organizationId, input.id);

    if (!existing) {
      throw new BusinessError("Warehouse was not found.", "WAREHOUSE_NOT_FOUND");
    }

    if (input.isDefault && !existing.isDefault) {
      await this.warehouses.clearDefault(context.organizationId);
    }

    try {
      const warehouse = await this.warehouses.update(context.organizationId, input);

      await this.activityLogs.create({
        organizationId: context.organizationId,
        userId: context.userId,
        action: "WAREHOUSE_UPDATED",
        entityType: "Warehouse",
        entityId: warehouse!.id,
        summary: `Warehouse ${warehouse!.name} was updated.`,
        metadata: { code: warehouse!.code, isDefault: warehouse!.isDefault },
      });

      return warehouse;
    } catch (error) {
      if (error instanceof Error && error.message.includes("Unique constraint failed")) {
        throw new BusinessError("A warehouse with this code already exists.", "WAREHOUSE_CODE_EXISTS");
      }

      throw error;
    }
  }

  async archive(context: AuthenticatedRequestContext, id: string) {
    const warehouse = await this.requireWarehouse(context, id);

    await this.warehouses.archive(context.organizationId, id);
    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "WAREHOUSE_ARCHIVED",
      entityType: "Warehouse",
      entityId: id,
      summary: `Warehouse ${warehouse.name} was archived.`,
      metadata: { code: warehouse.code },
    });
  }

  async activate(context: AuthenticatedRequestContext, id: string) {
    const warehouse = await this.requireWarehouse(context, id);

    await this.warehouses.activate(context.organizationId, id);
    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "WAREHOUSE_ACTIVATED",
      entityType: "Warehouse",
      entityId: id,
      summary: `Warehouse ${warehouse.name} was activated.`,
      metadata: { code: warehouse.code },
    });
  }

  async delete(context: AuthenticatedRequestContext, id: string) {
    const warehouse = await this.requireWarehouse(context, id);
    const references = await this.warehouses.countBlockingReferences(context.organizationId, id);

    if (references.total > 0) {
      throw new BusinessError(
        "Warehouse cannot be deleted because it has related stock entries or shipments.",
        "WAREHOUSE_IN_USE",
      );
    }

    await this.warehouses.delete(context.organizationId, id);
    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "WAREHOUSE_DELETED",
      entityType: "Warehouse",
      entityId: id,
      summary: `Warehouse ${warehouse.name} was deleted.`,
      metadata: { code: warehouse.code },
    });
  }

  private async requireWarehouse(context: AuthenticatedRequestContext, id: string) {
    const warehouse = await this.warehouses.findById(context.organizationId, id);

    if (!warehouse) {
      throw new BusinessError("Warehouse was not found.", "WAREHOUSE_NOT_FOUND");
    }

    return warehouse;
  }
}
