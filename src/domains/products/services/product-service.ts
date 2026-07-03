import { Prisma } from "@prisma/client";

import { ActivityLogRepository } from "@/domains/activity/repositories/activity-log-repository";
import { CategoryRepository } from "@/domains/categories/repositories/category-repository";
import { SupplierRepository } from "@/domains/suppliers/repositories/supplier-repository";
import { UnitOfMeasureRepository } from "@/domains/units/repositories/unit-of-measure-repository";
import type { AuthenticatedRequestContext } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { ProductRepository } from "../repositories/product-repository";
import type { CreateProductInput, UpdateProductInput } from "../validation/product-schema";

export class ProductService {
  constructor(
    private readonly products = new ProductRepository(),
    private readonly categories = new CategoryRepository(),
    private readonly suppliers = new SupplierRepository(),
    private readonly units = new UnitOfMeasureRepository(),
    private readonly activityLogs = new ActivityLogRepository(),
  ) {}

  async listForCatalog(context: AuthenticatedRequestContext) {
    return this.products.listForCatalog(context.organizationId);
  }

  async create(context: AuthenticatedRequestContext, input: CreateProductInput) {
    await this.validateProductReferences(context, input);

    try {
      const product = await this.products.create(context.organizationId, input);

      await this.activityLogs.create({
        organizationId: context.organizationId,
        userId: context.userId,
        action: "PRODUCT_CREATED",
        entityType: "Product",
        entityId: product.id,
        summary: `Product ${product.name} was created.`,
        metadata: {
          sku: product.sku,
          barcode: product.barcode,
          status: product.status,
          categoryId: product.categoryId,
          supplierId: product.supplierId,
          unitOfMeasureId: product.unitOfMeasureId,
        },
      });

      return product;
    } catch (error) {
      this.handleUniqueConstraintError(error);
      throw error;
    }
  }

  async update(context: AuthenticatedRequestContext, input: UpdateProductInput) {
    const existing = await this.products.findById(context.organizationId, input.id);

    if (!existing) {
      throw new BusinessError("Product was not found.", "PRODUCT_NOT_FOUND");
    }

    await this.validateProductReferences(context, input);

    try {
      const product = await this.products.update(context.organizationId, input);

      if (!product) {
        throw new BusinessError("Product was not found.", "PRODUCT_NOT_FOUND");
      }

      await this.activityLogs.create({
        organizationId: context.organizationId,
        userId: context.userId,
        action: "PRODUCT_UPDATED",
        entityType: "Product",
        entityId: product.id,
        summary: `Product ${product.name} was updated.`,
        metadata: {
          sku: product.sku,
          barcode: product.barcode,
          status: product.status,
          categoryId: product.categoryId,
          supplierId: product.supplierId,
          unitOfMeasureId: product.unitOfMeasureId,
        },
      });

      return product;
    } catch (error) {
      this.handleUniqueConstraintError(error);
      throw error;
    }
  }

  async archive(context: AuthenticatedRequestContext, id: string) {
    const product = await this.requireProduct(context, id);

    await this.products.archive(context.organizationId, id);
    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "PRODUCT_ARCHIVED",
      entityType: "Product",
      entityId: id,
      summary: `Product ${product.name} was archived.`,
      metadata: {
        sku: product.sku,
      },
    });
  }

  async activate(context: AuthenticatedRequestContext, id: string) {
    const product = await this.requireProduct(context, id);

    await this.products.activate(context.organizationId, id);
    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "PRODUCT_ACTIVATED",
      entityType: "Product",
      entityId: id,
      summary: `Product ${product.name} was activated.`,
      metadata: {
        sku: product.sku,
      },
    });
  }

  async delete(context: AuthenticatedRequestContext, id: string) {
    const product = await this.requireProduct(context, id);
    const references = await this.products.countBlockingReferences(context.organizationId, id);

    if (references.total > 0) {
      throw new BusinessError("Product cannot be deleted because it is referenced by related records.", "PRODUCT_IN_USE");
    }

    await this.products.delete(context.organizationId, id);
    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "PRODUCT_DELETED",
      entityType: "Product",
      entityId: id,
      summary: `Product ${product.name} was deleted.`,
      metadata: {
        sku: product.sku,
      },
    });
  }

  private async requireProduct(context: AuthenticatedRequestContext, id: string) {
    const product = await this.products.findById(context.organizationId, id);

    if (!product) {
      throw new BusinessError("Product was not found.", "PRODUCT_NOT_FOUND");
    }

    return product;
  }

  private async validateProductReferences(
    context: AuthenticatedRequestContext,
    input: Pick<CreateProductInput, "categoryId" | "supplierId" | "unitOfMeasureId">,
  ) {
    const [category, units] = await Promise.all([
      this.categories.findActiveById(context.organizationId, input.categoryId),
      this.units.listActive(context.organizationId),
    ]);

    if (!category) {
      throw new BusinessError("Category was not found.", "PRODUCT_CATEGORY_NOT_FOUND");
    }

    if (!units.some((unit) => unit.id === input.unitOfMeasureId)) {
      throw new BusinessError("Unit of measure was not found.", "PRODUCT_UNIT_NOT_FOUND");
    }

    if (input.supplierId) {
      const suppliers = await this.suppliers.listActive(context.organizationId);

      if (!suppliers.some((supplier) => supplier.id === input.supplierId)) {
        throw new BusinessError("Supplier was not found.", "PRODUCT_SUPPLIER_NOT_FOUND");
      }
    }
  }

  private handleUniqueConstraintError(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new BusinessError("A product with this SKU or barcode already exists.", "PRODUCT_EXISTS");
    }
  }
}
