import { Prisma } from "@prisma/client";

import { ActivityLogRepository } from "@/domains/activity/repositories/activity-log-repository";
import type { AuthenticatedRequestContext } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { SupplierRepository } from "../repositories/supplier-repository";
import type { CreateSupplierInput } from "../validation/supplier-schema";

export class SupplierService {
  constructor(
    private readonly suppliers = new SupplierRepository(),
    private readonly activityLogs = new ActivityLogRepository(),
  ) {}

  async listActive(context: AuthenticatedRequestContext) {
    return this.suppliers.listActive(context.organizationId);
  }

  async create(context: AuthenticatedRequestContext, input: CreateSupplierInput) {
    try {
      const supplier = await this.suppliers.create(context.organizationId, input);

      await this.activityLogs.create({
        organizationId: context.organizationId,
        userId: context.userId,
        action: "SUPPLIER_CREATED",
        entityType: "Supplier",
        entityId: supplier.id,
        summary: `Supplier ${supplier.name} was created.`,
        metadata: {
          code: supplier.code,
          email: supplier.email,
          leadTimeDays: supplier.leadTimeDays,
        },
      });

      return supplier;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new BusinessError("A supplier with this name or code already exists.", "SUPPLIER_EXISTS");
      }

      throw error;
    }
  }
}
