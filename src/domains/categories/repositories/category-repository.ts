import { prisma } from "@/infrastructure/database/prisma";

import type { CreateCategoryInput, UpdateCategoryInput } from "../validation/category-schema";

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

  async listAll(organizationId: string) {
    return prisma.category.findMany({
      where: { organizationId },
      include: { parent: true },
      orderBy: [{ parentId: "asc" }, { name: "asc" }],
    });
  }

  async findById(organizationId: string, id: string) {
    return prisma.category.findFirst({
      where: { id, organizationId },
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

  async update(organizationId: string, input: UpdateCategoryInput) {
    await prisma.category.updateMany({
      where: { id: input.id, organizationId },
      data: {
        parentId: input.parentId ?? null,
        name: input.name,
        code: input.code ?? null,
        description: input.description ?? null,
      },
    });

    return this.findById(organizationId, input.id);
  }

  async archive(organizationId: string, id: string) {
    return prisma.category.updateMany({
      where: { id, organizationId },
      data: { archivedAt: new Date() },
    });
  }

  async activate(organizationId: string, id: string) {
    return prisma.category.updateMany({
      where: { id, organizationId },
      data: { archivedAt: null },
    });
  }

  async countBlockingReferences(organizationId: string, id: string) {
    const productCount = await prisma.product.count({
      where: { organizationId, categoryId: id, archivedAt: null },
    });
    const childCount = await prisma.category.count({
      where: { organizationId, parentId: id, archivedAt: null },
    });

    return {
      total: productCount + childCount,
      details: { products: productCount, childCategories: childCount },
    };
  }

  async delete(organizationId: string, id: string) {
    return prisma.category.deleteMany({
      where: { id, organizationId },
    });
  }
}
