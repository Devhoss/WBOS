import { Prisma } from "@prisma/client";

import { ActivityLogRepository } from "@/domains/activity/repositories/activity-log-repository";
import type { AuthenticatedRequestContext } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { CategoryRepository } from "../repositories/category-repository";
import type { CreateCategoryInput } from "../validation/category-schema";

export class CategoryService {
  constructor(
    private readonly categories = new CategoryRepository(),
    private readonly activityLogs = new ActivityLogRepository(),
  ) {}

  async listActive(context: AuthenticatedRequestContext) {
    return this.categories.listActive(context.organizationId);
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
}
