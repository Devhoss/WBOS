import { prisma } from "@/infrastructure/database/prisma";

import type { CreateCategoryInput } from "../validation/category-schema";

export class CategoryRepository {
  async listActive(organizationId: string) {
    return prisma.category.findMany({
      where: {
        organizationId,
        archivedAt: null,
      },
      include: {
        parent: true,
        _count: {
          select: { children: true },
        },
      },
      orderBy: [{ parentId: "asc" }, { name: "asc" }],
    });
  }

  async findActiveById(organizationId: string, categoryId: string) {
    return prisma.category.findFirst({
      where: {
        id: categoryId,
        organizationId,
        archivedAt: null,
      },
    });
  }

  async create(organizationId: string, input: CreateCategoryInput) {
    return prisma.category.create({
      data: {
        organizationId,
        parentId: input.parentId ?? null,
        name: input.name,
        code: input.code ?? null,
        description: input.description ?? null,
      },
    });
  }
}
