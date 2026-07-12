import type { InventoryDirection, InventoryMovementType } from "@prisma/client";

import { ActivityLogRepository } from "@/domains/activity/repositories/activity-log-repository";
import { DocumentNumberService } from "@/domains/documents/services/document-number-service";
import { WarehouseRepository } from "@/domains/warehouses/repositories/warehouse-repository";
import { prisma } from "@/infrastructure/database/prisma";
import type { AuthenticatedRequestContext } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { CycleCountRepository } from "../repositories/cycle-count-repository";
import { InventoryPostingService } from "./inventory-posting-service";
import { StockBalanceService } from "./stock-balance-service";
import type { CreateCycleCountInput, UpdateCycleCountLineInput } from "../validation/cycle-count-schema";

export class CycleCountService {
  constructor(
    private readonly counts = new CycleCountRepository(),
    private readonly warehouses = new WarehouseRepository(),
    private readonly documents = new DocumentNumberService(),
    private readonly posting = new InventoryPostingService(),
    private readonly balances = new StockBalanceService(),
    private readonly activityLogs = new ActivityLogRepository(),
  ) {}

  async create(context: AuthenticatedRequestContext, input: CreateCycleCountInput) {
    const warehouse = await this.warehouses.findActiveById(context.organizationId, input.warehouseId);

    if (!warehouse) {
      throw new BusinessError("Warehouse was not found.", "INVENTORY_WAREHOUSE_NOT_FOUND");
    }

    const now = new Date();
    const { documentNumber } = await this.documents.generate({
      organizationId: context.organizationId,
      documentType: "ADJ",
      year: now.getFullYear(),
      prefix: "CC",
    });

    const count = await this.counts.create(context.organizationId, documentNumber, context.userId, input);

    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "CYCLE_COUNT_CREATED",
      entityType: "CycleCount",
      entityId: count.id,
      summary: `Cycle count ${documentNumber} created for ${warehouse.name}.`,
      metadata: {
        countNumber: documentNumber,
        warehouseId: warehouse.id,
        lineCount: input.lines.length,
      },
    });

    return count;
  }

  async updateLine(context: AuthenticatedRequestContext, input: UpdateCycleCountLineInput) {
    const line = await this.counts.updateLineQty(context.organizationId, input.lineId, input.countedQty, input.notes);

    if (!line) {
      throw new BusinessError("Cycle count line was not found.", "CYCLE_COUNT_LINE_NOT_FOUND");
    }

    return line;
  }

  async complete(context: AuthenticatedRequestContext, id: string) {
    const count = await this.counts.findById(context.organizationId, id);

    if (!count) {
      throw new BusinessError("Cycle count was not found.", "CYCLE_COUNT_NOT_FOUND");
    }

    if (count.status !== "DRAFT" && count.status !== "IN_PROGRESS") {
      throw new BusinessError("Only active cycle counts can be completed.", "CYCLE_COUNT_INVALID_STATUS");
    }

    const missingCount = count.lines.some((l) => l.countedQty === null);

    if (missingCount) {
      throw new BusinessError("All lines must have a counted quantity before completing.", "CYCLE_COUNT_INCOMPLETE");
    }

    const now = new Date();

    await this.counts.updateStatus(context.organizationId, id, "COMPLETED", { countedAt: now });

    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "CYCLE_COUNT_COMPLETED",
      entityType: "CycleCount",
      entityId: id,
      summary: `Cycle count ${count.countNumber} completed.`,
      metadata: { countNumber: count.countNumber, warehouseId: count.warehouseId },
    });
  }

  async approve(context: AuthenticatedRequestContext, id: string) {
    const count = await this.counts.findById(context.organizationId, id);

    if (!count) {
      throw new BusinessError("Cycle count was not found.", "CYCLE_COUNT_NOT_FOUND");
    }

    if (count.status !== "COMPLETED") {
      throw new BusinessError("Only completed cycle counts can be approved.", "CYCLE_COUNT_INVALID_STATUS");
    }

    const now = new Date();

    await prisma.$transaction(async (tx) => {
      const postingLines = await Promise.all(
        count.lines
          .filter((line) => {
            const variance = Number(line.variance ?? 0);
            return variance !== 0;
          })
          .map(async (line) => {
            const product = await tx.product.findFirst({
              where: { id: line.productId, organizationId: context.organizationId },
              select: { unitOfMeasureId: true },
            });

            const variance = Number(line.variance ?? 0);
            const isPositive = variance > 0;
            const movementType: InventoryMovementType = isPositive ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT";
            const direction: InventoryDirection = isPositive ? "IN" : "OUT";

            return {
              productId: line.productId,
              unitOfMeasureId: product?.unitOfMeasureId ?? "",
              quantity: Math.abs(variance),
              toWarehouseId: isPositive ? count.warehouseId : undefined,
              fromWarehouseId: isPositive ? undefined : count.warehouseId,
              notes: `Cycle count adjustment: expected ${line.expectedQty}, counted ${line.countedQty}`,
              ledgerEntries: [
                {
                  warehouseId: count.warehouseId,
                  movementType,
                  direction,
                  quantity: Math.abs(variance),
                },
              ],
            };
          }),
      );

      if (postingLines.length > 0) {
        await this.posting.post(
          {
            organizationId: context.organizationId,
            type: "ADJUSTMENT_IN" as never,
            documentNumber: count.countNumber,
            referenceType: "CYCLE_COUNT",
            referenceId: count.id,
            occurredAt: now,
            createdById: context.userId,
            notes: `Cycle count ${count.countNumber} approval adjustments.`,
            lines: postingLines,
          },
          tx,
        );
      }

      await this.counts.updateStatus(context.organizationId, id, "APPROVED", {
        approvedById: context.userId,
        approvedAt: now,
      });
    });

    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "CYCLE_COUNT_APPROVED",
      entityType: "CycleCount",
      entityId: id,
      summary: `Cycle count ${count.countNumber} approved with inventory adjustments posted.`,
      metadata: {
        countNumber: count.countNumber,
        warehouseId: count.warehouseId,
        adjustmentCount: count.lines.filter((l) => Number(l.variance ?? 0) !== 0).length,
      },
    });
  }
}
