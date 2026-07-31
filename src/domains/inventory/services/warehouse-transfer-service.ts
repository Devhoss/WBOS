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
import { StockBalanceService } from "./stock-balance-service";
import type { WarehouseTransferInput } from "../validation/warehouse-transfer-schema";

export class WarehouseTransferService {
  constructor(
    private readonly products = new ProductRepository(),
    private readonly warehouses = new WarehouseRepository(),
    private readonly posting = new InventoryPostingService(),
    private readonly costing = new CostingService(),
    private readonly balances = new StockBalanceService(),
    private readonly documents = new DocumentNumberService(),
    private readonly activityLogs = new ActivityLogRepository(),
  ) {}

  async transfer(context: AuthenticatedRequestContext, input: WarehouseTransferInput) {
    if (input.sourceWarehouseId === input.destinationWarehouseId) {
      throw new BusinessError("Source and destination warehouses must be different.", "INVENTORY_TRANSFER_SAME_WAREHOUSE");
    }

    const [sourceWarehouse, destinationWarehouse] = await Promise.all([
      this.warehouses.findActiveById(context.organizationId, input.sourceWarehouseId),
      this.warehouses.findActiveById(context.organizationId, input.destinationWarehouseId),
    ]);

    if (!sourceWarehouse) {
      throw new BusinessError("Source warehouse was not found.", "INVENTORY_SOURCE_WAREHOUSE_NOT_FOUND");
    }

    if (!destinationWarehouse) {
      throw new BusinessError("Destination warehouse was not found.", "INVENTORY_DESTINATION_WAREHOUSE_NOT_FOUND");
    }

    const lines = await Promise.all(
      input.lines.map(async (line) => {
        const product = await this.products.findActiveById(context.organizationId, line.productId);

        if (!product) {
          throw new BusinessError(`Product was not found or is not active.`, "INVENTORY_PRODUCT_NOT_FOUND");
        }

        await this.balances.assertAvailable(context.organizationId, product.id, sourceWarehouse.id, line.quantity);

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
      documentType: "WT",
      year: now.getFullYear(),
      prefix: "WT",
    });

    const transaction = await prisma.$transaction(async (tx) => {
      const txn = await this.posting.post(
        {
          organizationId: context.organizationId,
          type: "TRANSFER_OUT",
          documentNumber,
          occurredAt: input.occurredAt ?? now,
          createdById: context.userId,
          notes: input.notes,
          lines: lines.map((line) => ({
            productId: line.product.id,
            unitOfMeasureId: line.product.unitOfMeasureId,
            quantity: line.quantity,
            fromWarehouseId: sourceWarehouse.id,
            toWarehouseId: destinationWarehouse.id,
            notes: line.notes,
            ledgerEntries: [
              {
                warehouseId: sourceWarehouse.id,
                movementType: "TRANSFER_OUT",
                direction: "OUT",
                quantity: line.quantity,
              },
              {
                warehouseId: destinationWarehouse.id,
                movementType: "TRANSFER_IN",
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
          const line = lines[i];
          const invLine = txn.lines[i];
          if (!invLine) continue;

          let outEntry: { id: string } | undefined;
          let inEntry: { id: string } | undefined;

          for (const entry of invLine.ledgerEntries) {
            if (entry.direction === "OUT") outEntry = entry;
            if (entry.direction === "IN") inEntry = entry;
          }

          if (outEntry) {
            const cost = await this.costing.recordIssue(
              {
                organizationId: context.organizationId,
                productId: line.product.id,
                warehouseId: sourceWarehouse.id,
                quantity: new Prisma.Decimal(Number(line.quantity)),
                ledgerEntryId: outEntry.id,
              },
              tx,
            );

            if (inEntry) {
              await this.costing.recordReceipt(
                {
                  organizationId: context.organizationId,
                  productId: line.product.id,
                  warehouseId: destinationWarehouse.id,
                  quantity: new Prisma.Decimal(Number(line.quantity)),
                  unitCost: cost.unitCost,
                  ledgerEntryId: inEntry.id,
                },
                tx,
              );
            }
          }
        }
      }

      return txn;
    });

    const productSummary = lines.map((line) => ({
      productId: line.product.id,
      sku: line.product.sku,
      quantity: line.quantity,
    }));

    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "INVENTORY_TRANSFERRED",
      entityType: "InventoryTransaction",
      entityId: transaction?.id,
      summary: `Transfer ${documentNumber}: ${lines.length} product(s) from ${sourceWarehouse.name} to ${destinationWarehouse.name}.`,
      metadata: {
        documentNumber,
        sourceWarehouseId: sourceWarehouse.id,
        destinationWarehouseId: destinationWarehouse.id,
        lineCount: lines.length,
        products: productSummary,
      },
    });

    return transaction;
  }
}
