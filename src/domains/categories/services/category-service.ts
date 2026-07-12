import { Prisma } from "@prisma/client";

import { ActivityLogRepository } from "@/domains/activity/repositories/activity-log-repository";
import type { AuthenticatedRequestContext } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { CategoryRepository } from "../repositories/category-repository";
import type { CreateCategoryInput, UpdateCategoryInput } from "../validation/category-schema";

export class CategoryService {
  constructor(
    private readonly categories = new CategoryRepository(),
    private readonly activityLogs = new ActivityLogRepository(),
  ) {}

  async listActive(context: AuthenticatedRequestContext) {
    return this.categories.listActive(context.organizationId);
  }

  async listAll(context: AuthenticatedRequestContext) {
    return this.categories.listAll(context.organizationId);
  }

  async create(context: AuthenticatedRequestContext, input: CreateCategoryInput) {
    if (input.parentId) {
      const parent = await this.categories.findActiveById(context.organizationId, input.parentId);

      if (!parent) {
        throw new BusinessError("Parent category was not found.", "CATEGORY_PARENT_NOT_FOUND");
      }
    }

    try {
      const category = await this.categories.create(context.organizationId, input);

      await this.activityLogs.create({
        organizationId: context.organizationId,
        userId: context.userId,
        action: "CATEGORY_CREATED",
        entityType: "Category",
        entityId: category.id,
        summary: `Category ${category.name} was created.`,
        metadata: {
          code: category.code,
          parentId: category.parentId,
        },
      });

      return category;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new BusinessError("A category with this name or code already exists.", "CATEGORY_EXISTS");
      }

      throw error;
    }
  }

  async update(context: AuthenticatedRequestContext, input: UpdateCategoryInput) {
    const existing = await this.categories.findById(context.organizationId, input.id);

    if (!existing) {
      throw new BusinessError("Category was not found.", "CATEGORY_NOT_FOUND");
    }

    if (input.parentId) {
      if (input.parentId === input.id) {
        throw new BusinessError("A category cannot be its own parent.", "CATEGORY_SELF_PARENT");
      }

      const parent = await this.categories.findActiveById(context.organizationId, input.parentId);

      if (!parent) {
        throw new BusinessError("Parent category was not found.", "CATEGORY_PARENT_NOT_FOUND");
      }
    }

    try {
      const category = await this.categories.update(context.organizationId, input);

      await this.activityLogs.create({
        organizationId: context.organizationId,
        userId: context.userId,
        action: "CATEGORY_UPDATED",
        entityType: "Category",
        entityId: category!.id,
        summary: `Category ${category!.name} was updated.`,
        metadata: { code: category!.code, parentId: category!.parentId },
      });

      return category;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new BusinessError("A category with this name or code already exists.", "CATEGORY_EXISTS");
      }

      throw error;
    }
  }

  async archive(context: AuthenticatedRequestContext, id: string) {
    const category = await this.requireCategory(context, id);

    await this.categories.archive(context.organizationId, id);
    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "CATEGORY_ARCHIVED",
      entityType: "Category",
      entityId: id,
      summary: `Category ${category.name} was archived.`,
      metadata: { code: category.code },
    });
  }

  async activate(context: AuthenticatedRequestContext, id: string) {
    const category = await this.requireCategory(context, id);

    await this.categories.activate(context.organizationId, id);
    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "CATEGORY_ACTIVATED",
      entityType: "Category",
      entityId: id,
      summary: `Category ${category.name} was activated.`,
      metadata: { code: category.code },
    });
  }

  async delete(context: AuthenticatedRequestContext, id: string) {
    const category = await this.requireCategory(context, id);
    const references = await this.categories.countBlockingReferences(context.organizationId, id);

    if (references.total > 0) {
      throw new BusinessError(
        "Category cannot be deleted because it has related products or subcategories.",
        "CATEGORY_IN_USE",
      );
    }

    await this.categories.delete(context.organizationId, id);
    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "CATEGORY_DELETED",
      entityType: "Category",
      entityId: id,
      summary: `Category ${category.name} was deleted.`,
      metadata: { code: category.code },
    });
  }

  private async requireCategory(context: AuthenticatedRequestContext, id: string) {
    const category = await this.categories.findById(context.organizationId, id);

    if (!category) {
      throw new BusinessError("Category was not found.", "CATEGORY_NOT_FOUND");
    }

    return category;
  }
}
