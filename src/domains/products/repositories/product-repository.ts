import { Prisma } from "@prisma/client";

import { prisma } from "@/infrastructure/database/prisma";

import type { CreateProductInput, UpdateProductInput } from "../validation/product-schema";

export class ProductRepository {
  async listForCatalog(organizationId: string) {
    return prisma.product.findMany({
      where: {
        organizationId,
      },
      include: {
        category: true,
        supplier: true,
        unitOfMeasure: true,
      },
      orderBy: { name: "asc" },
    });
  }

  async create(organizationId: string, input: CreateProductInput) {
    return prisma.product.create({
      data: {
        organizationId,
        categoryId: input.categoryId,
        supplierId: input.supplierId ?? null,
        unitOfMeasureId: input.unitOfMeasureId,
        sku: input.sku,
        barcode: input.barcode ?? null,
        name: input.name,
        description: input.description ?? null,
        status: input.status,
        defaultSellingPrice:
          input.defaultSellingPrice === undefined
            ? null
            : new Prisma.Decimal(input.defaultSellingPrice),
        defaultCurrency: input.defaultCurrency,
      },
    });
  }

  async findById(organizationId: string, id: string) {
    return prisma.product.findFirst({
      where: {
        id,
        organizationId,
      },
    });
  }

  async update(organizationId: string, input: UpdateProductInput) {
    await prisma.product.updateMany({
      where: {
        id: input.id,
        organizationId,
      },
      data: {
        sku: input.sku,
        categoryId: input.categoryId,
        supplierId: input.supplierId ?? null,
        unitOfMeasureId: input.unitOfMeasureId,
        barcode: input.barcode ?? null,
        name: input.name,
        description: input.description ?? null,
        status: input.status,
        archivedAt: input.status === "ARCHIVED" ? new Date() : null,
        defaultSellingPrice:
          input.defaultSellingPrice === undefined
            ? null
            : new Prisma.Decimal(input.defaultSellingPrice),
        defaultCurrency: input.defaultCurrency,
      },
    });

    return this.findById(organizationId, input.id);
  }

  async archive(organizationId: string, id: string) {
    return prisma.product.updateMany({
      where: {
        id,
        organizationId,
      },
      data: {
        status: "ARCHIVED",
        archivedAt: new Date(),
      },
    });
  }

  async activate(organizationId: string, id: string) {
    return prisma.product.updateMany({
      where: {
        id,
        organizationId,
      },
      data: {
        status: "ACTIVE",
        archivedAt: null,
      },
    });
  }

  async countBlockingReferences(organizationId: string, id: string) {
    const attachmentCount = await prisma.attachment.count({
      where: {
        organizationId,
        entityType: "Product",
        entityId: id,
        archivedAt: null,
      },
    });

    return {
      total: attachmentCount,
      details: {
        attachments: attachmentCount,
      },
    };
  }

  async delete(organizationId: string, id: string) {
    return prisma.product.deleteMany({
      where: {
        id,
        organizationId,
      },
    });
  }
}
