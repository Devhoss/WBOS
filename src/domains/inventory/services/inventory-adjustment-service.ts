import { ActivityLogRepository } from "@/domains/activity/repositories/activity-log-repository";
import { DocumentNumberService } from "@/domains/documents/services/document-number-service";
import { ProductRepository } from "@/domains/products/repositories/product-repository";
import { WarehouseRepository } from "@/domains/warehouses/repositories/warehouse-repository";
import type { AuthenticatedRequestContext } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { AdjustmentReasonService } from "./adjustment-reason-service";
import { InventoryPostingService } from "./inventory-posting-service";
import { StockBalanceService } from "./stock-balance-service";
import type { InventoryAdjustmentInput } from "../validation/inventory-adjustment-schema";

export class InventoryAdjustmentService {
  constructor(
    private readonly products = new ProductRepository(),
    private readonly warehouses = new WarehouseRepository(),
    private readonly reasons = new AdjustmentReasonService(),
    private readonly posting = new InventoryPostingService(),
    private readonly balances = new StockBalanceService(),
    private readonly documents = new DocumentNumberService(),
    private readonly activityLogs = new ActivityLogRepository(),
  ) {}

  async adjust(context: AuthenticatedRequestContext, input: InventoryAdjustmentInput) {
    const [warehouse, product, reason] = await Promise.all([
      this.warehouses.findActiveById(context.organizationId, input.warehouseId),
      this.products.findActiveById(context.organizationId, input.productId),
      this.reasons.findActiveByCode(context.organizationId, input.reasonCode),
    ]);

    if (!warehouse) {
      throw new BusinessError("Warehouse was not found.", "INVENTORY_WAREHOUSE_NOT_FOUND");
    }

    if (!product) {
      throw new BusinessError("Product was not found or is not active.", "INVENTORY_PRODUCT_NOT_FOUND");
    }

    if (!reason) {
      throw new BusinessError("Adjustment reason was not found.", "INVENTORY_REASON_NOT_FOUND");
    }

    if (reason.direction && reason.direction !== input.direction) {
      throw new BusinessError("Adjustment reason does not match the selected direction.", "INVENTORY_REASON_DIRECTION_MISMATCH");
    }

    if (input.direction === "OUT") {
      await this.balances.assertAvailable(context.organizationId, product.id, warehouse.id, input.quantity);
    }

    const now = new Date();
    const { documentNumber } = await this.documents.generate({
      organizationId: context.organizationId,
      documentType: "ADJ",
      year: now.getFullYear(),
      prefix: "ADJ",
    });

    const movementType = this.getMovementType(input.direction, reason.code);
    const transaction = await this.posting.post({
      organizationId: context.organizationId,
      type: movementType,
      documentNumber,
      occurredAt: now,
      createdById: context.userId,
      notes: input.notes,
      lines: [
        {
          productId: product.id,
          unitOfMeasureId: product.unitOfMeasureId,
          quantity: input.quantity,
          fromWarehouseId: input.direction === "OUT" ? warehouse.id : null,
          toWarehouseId: input.direction === "IN" ? warehouse.id : null,
          adjustmentReasonId: reason.id,
          notes: input.notes,
          ledgerEntries: [
            {
              warehouseId: warehouse.id,
              movementType,
              direction: input.direction,
              quantity: input.quantity,
            },
          ],
        },
      ],
    });

    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "INVENTORY_ADJUSTED",
      entityType: "InventoryTransaction",
      entityId: transaction?.id,
      summary: `Adjustment ${documentNumber} for ${product.name} in ${warehouse.name}.`,
      metadata: {
        documentNumber,
        productId: product.id,
        sku: product.sku,
        warehouseId: warehouse.id,
        direction: input.direction,
        quantity: input.quantity,
        reasonCode: reason.code,
      },
    });

    return transaction;
  }

  private getMovementType(direction: "IN" | "OUT", reasonCode: string) {
    if (reasonCode === "OPENING_BALANCE") {
      return "OPENING_BALANCE";
    }

    if (reasonCode === "DAMAGE") {
      return "DAMAGE";
    }

    if (reasonCode === "EXPIRED") {
      return "EXPIRED";
    }

    return direction === "IN" ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT";
  }
}
