import { Prisma } from "@prisma/client";

import { ActivityLogRepository } from "@/domains/activity/repositories/activity-log-repository";
import { DocumentNumberService } from "@/domains/documents/services/document-number-service";
import { InventoryPostingService } from "@/domains/inventory/services/inventory-posting-service";
import { ProductRepository } from "@/domains/products/repositories/product-repository";
import { WarehouseRepository } from "@/domains/warehouses/repositories/warehouse-repository";
import { prisma } from "@/infrastructure/database/prisma";
import type { AuthenticatedRequestContext } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { PurchaseOrderRepository } from "../repositories/purchase-order-repository";
import type { GoodsReceiptInput } from "../validation/goods-receipt-schema";

export class GoodsReceiptService {
  constructor(
    private readonly orders = new PurchaseOrderRepository(),
    private readonly products = new ProductRepository(),
    private readonly warehouses = new WarehouseRepository(),
    private readonly posting = new InventoryPostingService(),
    private readonly documents = new DocumentNumberService(),
    private readonly activityLogs = new ActivityLogRepository(),
  ) {}

  async receive(context: AuthenticatedRequestContext, input: GoodsReceiptInput) {
    const order = await this.orders.findById(context.organizationId, input.purchaseOrderId);

    if (!order) {
      throw new BusinessError("Purchase order was not found.", "PURCHASING_ORDER_NOT_FOUND");
    }

    if (order.status !== "APPROVED" && order.status !== "PARTIALLY_RECEIVED") {
      throw new BusinessError(
        "Goods can only be received against approved purchase orders.",
        "PURCHASING_NOT_APPROVED",
      );
    }

    if (order.archivedAt) {
      throw new BusinessError("Purchase order is archived.", "PURCHASING_ARCHIVED");
    }

    const warehouse = await this.warehouses.findActiveById(context.organizationId, input.warehouseId);

    if (!warehouse) {
      throw new BusinessError("Warehouse was not found.", "INVENTORY_WAREHOUSE_NOT_FOUND");
    }

    const processedLines = await Promise.all(
      input.lines.map(async (receiptLine) => {
        const poLine = order.lines.find((l) => l.id === receiptLine.purchaseOrderLineId);

        if (!poLine) {
          throw new BusinessError(
            `Purchase order line was not found.`,
            "PURCHASING_LINE_NOT_FOUND",
          );
        }

        const product = await this.products.findActiveById(context.organizationId, receiptLine.productId);

        if (!product) {
          throw new BusinessError(
            `Product was not found or is not active.`,
            "PURCHASING_PRODUCT_NOT_FOUND",
          );
        }

        const remaining = Number(poLine.orderedQuantity) - Number(poLine.receivedQuantity);

        if (Number(receiptLine.quantity) > remaining) {
          throw new BusinessError(
            `Receiving quantity exceeds the remaining ordered quantity (${remaining}).`,
            "PURCHASING_OVER_RECEIVE",
          );
        }

        return { poLine, product, quantity: receiptLine.quantity, notes: receiptLine.notes };
      }),
    );

    const now = new Date();
    const { documentNumber } = await this.documents.generate({
      organizationId: context.organizationId,
      documentType: "GRN",
      year: now.getFullYear(),
      prefix: "GRN",
    });

    const result = await prisma.$transaction(async (tx) => {
      const transaction = await this.posting.post(
        {
          organizationId: context.organizationId,
          type: "PURCHASE_RECEIPT",
          documentNumber,
          referenceType: "PURCHASE_ORDER",
          referenceId: order.id,
          occurredAt: input.occurredAt ?? now,
          createdById: context.userId,
          notes: input.notes,
          lines: processedLines.map((line) => ({
            productId: line.product.id,
            unitOfMeasureId: line.product.unitOfMeasureId,
            quantity: line.quantity,
            toWarehouseId: warehouse.id,
            notes: line.notes,
            ledgerEntries: [
              {
                warehouseId: warehouse.id,
                movementType: "PURCHASE_RECEIPT" as const,
                direction: "IN" as const,
                quantity: line.quantity,
              },
            ],
          })),
        },
        tx,
      );

      for (const line of processedLines) {
        await tx.purchaseOrderLine.updateMany({
          where: {
            id: line.poLine.id,
            organizationId: context.organizationId,
          },
          data: {
            receivedQuantity: { increment: new Prisma.Decimal(line.quantity) },
          },
        });
      }

      const updatedLines = await tx.purchaseOrderLine.findMany({
        where: { purchaseOrderId: order.id, organizationId: context.organizationId },
      });

      const allFullyReceived = updatedLines.every(
        (l) => Number(l.receivedQuantity) >= Number(l.orderedQuantity),
      );

      if (allFullyReceived) {
        await tx.purchaseOrder.updateMany({
          where: { id: order.id, organizationId: context.organizationId },
          data: { status: "FULLY_RECEIVED" },
        });
      } else if (order.status === "APPROVED") {
        await tx.purchaseOrder.updateMany({
          where: { id: order.id, organizationId: context.organizationId },
          data: { status: "PARTIALLY_RECEIVED" },
        });
      }

      return transaction;
    });

    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "GOODS_RECEIVED",
      entityType: "InventoryTransaction",
      entityId: result?.id,
      summary: `Goods receipt ${documentNumber} posted for purchase order ${order.poNumber}.`,
      metadata: {
        documentNumber,
        purchaseOrderId: order.id,
        poNumber: order.poNumber,
        warehouseId: warehouse.id,
        lineCount: processedLines.length,
        products: processedLines.map((line) => ({
          productId: line.product.id,
          sku: line.product.sku,
          quantity: line.quantity,
        })),
      },
    });

    return result;
  }
}
