import { BusinessError } from "@/shared/errors/business-error";

import { ActivityLogRepository } from "@/domains/activity/repositories/activity-log-repository";
import type { AuthenticatedRequestContext } from "@/infrastructure/request/authenticated-request-context";

import { WarehouseRepository } from "../repositories/warehouse-repository";
import type { CreateWarehouseInput } from "../validation/warehouse-schema";

export class WarehouseService {
  constructor(
    private readonly warehouses = new WarehouseRepository(),
    private readonly activityLogs = new ActivityLogRepository(),
  ) {}

  async listActive(context: AuthenticatedRequestContext) {
    return this.warehouses.listActive(context.organizationId);
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
        metadata: {
          code: warehouse.code,
          isDefault: warehouse.isDefault,
        },
      });

      return warehouse;
    } catch (error) {
      if (error instanceof Error && error.message.includes("Unique constraint failed")) {
        throw new BusinessError("A warehouse with this code already exists.", "WAREHOUSE_CODE_EXISTS");
      }

      throw error;
    }
  }
}
