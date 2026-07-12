import { ActivityLogRepository } from "@/domains/activity/repositories/activity-log-repository";
import { DocumentNumberService } from "@/domains/documents/services/document-number-service";
import { ProductRepository } from "@/domains/products/repositories/product-repository";
import { WarehouseRepository } from "@/domains/warehouses/repositories/warehouse-repository";
import type { AuthenticatedRequestContext } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { InventoryPostingService } from "./inventory-posting-service";
import type { ManualReceiptInput } from "../validation/manual-receipt-schema";

export class ManualReceiptService {
  constructor(
    private readonly products = new ProductRepository(),
    private readonly warehouses = new WarehouseRepository(),
    private readonly posting = new InventoryPostingService(),
    private readonly documents = new DocumentNumberService(),
    private readonly activityLogs = new ActivityLogRepository(),
  ) {}

  async receive(context: AuthenticatedRequestContext, input: ManualReceiptInput) {
    const warehouse = await this.warehouses.findActiveById(context.organizationId, input.warehouseId);

    if (!warehouse) {
      throw new BusinessError("Warehouse was not found.", "INVENTORY_WAREHOUSE_NOT_FOUND");
    }

    const lines = await Promise.all(
      input.lines.map(async (line) => {
        const product = await this.products.findActiveById(context.organizationId, line.productId);

        if (!product) {
          throw new BusinessError("Product was not found or is not active.", "INVENTORY_PRODUCT_NOT_FOUND");
        }

        return {
          product,
          quantity: line.quantity,
          notes: line.notes,
        };
      }),
    );

    const now = new Date();
    const { documentNumber } = await this.documents.generate({
      organizationId: context.organizationId,
      documentType: "GRN",
      year: now.getFullYear(),
      prefix: "GRN",
    });

    const transaction = await this.posting.post({
      organizationId: context.organizationId,
      type: "MANUAL_RECEIPT",
      documentNumber,
      occurredAt: input.occurredAt ?? now,
      createdById: context.userId,
      notes: input.notes,
      lines: lines.map((line) => ({
        productId: line.product.id,
        unitOfMeasureId: line.product.unitOfMeasureId,
        quantity: line.quantity,
        toWarehouseId: warehouse.id,
        notes: line.notes,
        ledgerEntries: [
          {
            warehouseId: warehouse.id,
            movementType: "MANUAL_RECEIPT",
            direction: "IN",
            quantity: line.quantity,
          },
        ],
      })),
    });

    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "INVENTORY_RECEIVED",
      entityType: "InventoryTransaction",
      entityId: transaction?.id,
      summary: `Manual receipt ${documentNumber} posted to ${warehouse.name}.`,
      metadata: {
        documentNumber,
        warehouseId: warehouse.id,
        lineCount: lines.length,
        products: lines.map((line) => ({
          productId: line.product.id,
          sku: line.product.sku,
          quantity: line.quantity,
        })),
      },
    });

    return transaction;
  }
}
