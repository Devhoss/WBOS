import { Prisma } from "@prisma/client";

import { ActivityLogRepository } from "@/domains/activity/repositories/activity-log-repository";
import { DocumentNumberService } from "@/domains/documents/services/document-number-service";
import { ProductRepository } from "@/domains/products/repositories/product-repository";
import { WarehouseRepository } from "@/domains/warehouses/repositories/warehouse-repository";
import { prisma } from "@/infrastructure/database/prisma";
import type { AuthenticatedRequestContext } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { CostingService } from "./costing-service";
import { InventoryPostingService } from "./inventory-posting-service";
import type { ManualReceiptInput } from "../validation/manual-receipt-schema";

export class ManualReceiptService {
  constructor(
    private readonly products = new ProductRepository(),
    private readonly warehouses = new WarehouseRepository(),
    private readonly posting = new InventoryPostingService(),
    private readonly costing = new CostingService(),
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
          unitCost: line.unitCost != null ? new Prisma.Decimal(line.unitCost) : undefined,
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

    const transaction = await prisma.$transaction(async (tx) => {
      const txn = await this.posting.post(
        {
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
        },
        tx,
      );

      if (txn) {
        for (let i = 0; i < lines.length; i++) {
          const invLine = txn.lines[i];
          if (!invLine) continue;

          const line = lines[i];
          const unitCost = line.unitCost
            ?? (await this.costing.getAverageCost(
              context.organizationId,
              line.product.id,
              warehouse.id,
            ))
            ?? new Prisma.Decimal(0);

          for (const entry of invLine.ledgerEntries) {
            await this.costing.recordReceipt(
              {
                organizationId: context.organizationId,
                productId: line.product.id,
                warehouseId: warehouse.id,
                quantity: new Prisma.Decimal(Number(line.quantity)),
                unitCost,
                ledgerEntryId: entry.id,
              },
              tx,
            );
          }
        }
      }

      return txn;
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
