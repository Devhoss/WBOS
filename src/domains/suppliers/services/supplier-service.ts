import { Prisma } from "@prisma/client";

import { ActivityLogRepository } from "@/domains/activity/repositories/activity-log-repository";
import type { AuthenticatedRequestContext } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { SupplierRepository } from "../repositories/supplier-repository";
import type { CreateSupplierInput, UpdateSupplierInput } from "../validation/supplier-schema";

export class SupplierService {
  constructor(
    private readonly suppliers = new SupplierRepository(),
    private readonly activityLogs = new ActivityLogRepository(),
  ) {}

  async listActive(context: AuthenticatedRequestContext) {
    return this.suppliers.listActive(context.organizationId);
  }

  async listAll(context: AuthenticatedRequestContext) {
    return this.suppliers.listAll(context.organizationId);
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

  async update(context: AuthenticatedRequestContext, input: UpdateSupplierInput) {
    const existing = await this.suppliers.findById(context.organizationId, input.id);

    if (!existing) {
      throw new BusinessError("Supplier was not found.", "SUPPLIER_NOT_FOUND");
    }

    try {
      const supplier = await this.suppliers.update(context.organizationId, input);

      await this.activityLogs.create({
        organizationId: context.organizationId,
        userId: context.userId,
        action: "SUPPLIER_UPDATED",
        entityType: "Supplier",
        entityId: supplier!.id,
        summary: `Supplier ${supplier!.name} was updated.`,
        metadata: { code: supplier!.code, email: supplier!.email },
      });

      return supplier;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new BusinessError("A supplier with this name or code already exists.", "SUPPLIER_EXISTS");
      }

      throw error;
    }
  }

  async archive(context: AuthenticatedRequestContext, id: string) {
    const supplier = await this.requireSupplier(context, id);

    await this.suppliers.archive(context.organizationId, id);
    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "SUPPLIER_ARCHIVED",
      entityType: "Supplier",
      entityId: id,
      summary: `Supplier ${supplier.name} was archived.`,
      metadata: { code: supplier.code },
    });
  }

  async activate(context: AuthenticatedRequestContext, id: string) {
    const supplier = await this.requireSupplier(context, id);

    await this.suppliers.activate(context.organizationId, id);
    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "SUPPLIER_ACTIVATED",
      entityType: "Supplier",
      entityId: id,
      summary: `Supplier ${supplier.name} was activated.`,
      metadata: { code: supplier.code },
    });
  }

  async delete(context: AuthenticatedRequestContext, id: string) {
    const supplier = await this.requireSupplier(context, id);
    const references = await this.suppliers.countBlockingReferences(context.organizationId, id);

    if (references.total > 0) {
      throw new BusinessError(
        "Supplier cannot be deleted because it is referenced by related records.",
        "SUPPLIER_IN_USE",
      );
    }

    await this.suppliers.delete(context.organizationId, id);
    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "SUPPLIER_DELETED",
      entityType: "Supplier",
      entityId: id,
      summary: `Supplier ${supplier.name} was deleted.`,
      metadata: { code: supplier.code },
    });
  }

  private async requireSupplier(context: AuthenticatedRequestContext, id: string) {
    const supplier = await this.suppliers.findById(context.organizationId, id);

    if (!supplier) {
      throw new BusinessError("Supplier was not found.", "SUPPLIER_NOT_FOUND");
    }

    return supplier;
  }
}
