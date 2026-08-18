import { Prisma } from "@prisma/client";

import { ActivityLogRepository } from "@/domains/activity/repositories/activity-log-repository";
import { DocumentNumberService } from "@/domains/documents/services/document-number-service";
import { CostingService } from "@/domains/inventory/services/costing-service";
import { InventoryPostingService } from "@/domains/inventory/services/inventory-posting-service";
import { StockBalanceService } from "@/domains/inventory/services/stock-balance-service";
import { ProductRepository } from "@/domains/products/repositories/product-repository";
import { WarehouseRepository } from "@/domains/warehouses/repositories/warehouse-repository";
import { prisma } from "@/infrastructure/database/prisma";
import type { AuthenticatedRequestContext } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { SalesOrderRepository } from "../repositories/sales-order-repository";
import { ShipmentRepository } from "../repositories/shipment-repository";
import type { CreateShipmentInput } from "../validation/shipment-schema";

export class ShipmentService {
  constructor(
    private readonly shipments = new ShipmentRepository(),
    private readonly orders = new SalesOrderRepository(),
    private readonly products = new ProductRepository(),
    private readonly warehouses = new WarehouseRepository(),
    private readonly posting = new InventoryPostingService(),
    private readonly costing = new CostingService(),
    private readonly balances = new StockBalanceService(),
    private readonly documents = new DocumentNumberService(),
    private readonly activityLogs = new ActivityLogRepository(),
  ) {}

  async create(context: AuthenticatedRequestContext, input: CreateShipmentInput) {
    const order = await this.orders.findById(context.organizationId, input.salesOrderId);

    if (!order) {
      throw new BusinessError("Sales order was not found.", "SALES_ORDER_NOT_FOUND");
    }

    if (order.status !== "APPROVED" && order.status !== "READY_FOR_INVOICE" && order.status !== "INVOICED") {
      throw new BusinessError("Shipments can only be created for approved sales orders.", "SALES_NOT_APPROVED");
    }

    const warehouse = await this.warehouses.findActiveById(context.organizationId, input.warehouseId);

    if (!warehouse) {
      throw new BusinessError("Warehouse was not found.", "INVENTORY_WAREHOUSE_NOT_FOUND");
    }

    const existingShipments = await this.shipments.listBySalesOrderNonDelivered(
      context.organizationId,
      input.salesOrderId,
    );

    for (const line of input.lines) {
      const soLine = order.lines.find((l) => l.id === line.salesOrderLineId);

      if (!soLine) {
        throw new BusinessError("Sales order line was not found.", "SALES_LINE_NOT_FOUND");
      }

      const deliveredQty = Number(soLine.shippedQuantity);
      const allocatedQty = existingShipments.reduce(
        (sum, s) => sum + s.lines
          .filter((l) => l.salesOrderLineId === line.salesOrderLineId)
          .reduce((s2, l) => s2 + Number(l.quantity), 0),
        0,
      );
      const remaining = Number(soLine.orderedQuantity) - deliveredQty - allocatedQty;

      if (Number(line.quantity) > remaining) {
        throw new BusinessError(
          `Shipping quantity exceeds the remaining order quantity (${remaining.toFixed(3)} remaining after existing shipments).`,
          "SALES_OVER_SHIP",
        );
      }

      await this.balances.assertAvailable(
        context.organizationId,
        line.productId,
        warehouse.id,
        line.quantity,
      );
    }

    const now = new Date();
    const { documentNumber } = await this.documents.generate({
      organizationId: context.organizationId,
      documentType: "SHP",
      year: now.getFullYear(),
      prefix: "SHP",
    });

    const shipment = await this.shipments.create(
      context.organizationId,
      documentNumber,
      context.userId,
      input,
    );

    await prisma.invoice.updateMany({
      where: { salesOrderId: input.salesOrderId, organizationId: context.organizationId },
      data: { warehouseName: warehouse.name },
    });

    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "SHIPMENT_CREATED",
      entityType: "Shipment",
      entityId: shipment.id,
      summary: `Shipment ${documentNumber} created for ${order.soNumber} by ${context.user.name}.`,
      metadata: {
        shipmentNumber: documentNumber,
        salesOrderId: order.id,
        soNumber: order.soNumber,
        warehouseId: warehouse.id,
        lineCount: input.lines.length,
      },
    });

    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "SHIPMENT_CREATED",
      entityType: "SalesOrder",
      entityId: order.id,
      summary: `Shipment ${documentNumber} was created for this order.`,
      metadata: {
        shipmentNumber: documentNumber,
        warehouseId: warehouse.id,
      },
    });

    return shipment;
  }

  async addPickQuantity(context: AuthenticatedRequestContext, shipmentId: string, lineId: string, quantity: number) {
    const shipment = await this.shipments.findById(context.organizationId, shipmentId);

    if (!shipment) {
      throw new BusinessError("Shipment was not found.", "SHIPMENT_NOT_FOUND");
    }

    if (shipment.status !== "PENDING_PICK" && shipment.status !== "PICKING" && shipment.status !== "PICKED") {
      throw new BusinessError("Shipment is not in picking status.", "SHIPMENT_INVALID_STATUS");
    }

    const line = shipment.lines.find((l) => l.id === lineId);

    if (!line) {
      throw new BusinessError("Shipment line was not found.", "SHIPMENT_LINE_NOT_FOUND");
    }

    if (quantity <= 0) {
      throw new BusinessError("Quantity must be greater than zero.", "SHIPMENT_INVALID_QUANTITY");
    }

    const currentPicked = Number(line.pickedQuantity);
    const remaining = Number(line.quantity) - currentPicked;

    // Fast, friendly rejection for the common case. NOT the concurrency guard —
    // the conditional UPDATE below is, because this value is already stale by
    // the time we write.
    if (quantity > remaining) {
      throw new BusinessError(
        `Cannot pick ${quantity} — only ${remaining} remaining for this line.`,
        "SHIPMENT_OVER_PICK",
      );
    }

    const delta = new Prisma.Decimal(quantity);
    const applied = await prisma.$executeRaw`
      UPDATE "shipment_lines"
         SET "pickedQuantity" = "pickedQuantity" + ${delta}
       WHERE "id" = ${line.id}
         AND "organizationId" = ${context.organizationId}
         AND "pickedQuantity" + ${delta} <= "quantity"
    `;

    if (Number(applied) !== 1) {
      const fresh = await prisma.shipmentLine.findFirst({
        where: { id: line.id, organizationId: context.organizationId },
        select: { pickedQuantity: true, quantity: true },
      });
      const left = fresh ? Number(fresh.quantity) - Number(fresh.pickedQuantity) : 0;
      throw new BusinessError(
        `Cannot pick ${quantity} — only ${left} remaining for this line.`,
        "SHIPMENT_OVER_PICK",
      );
    }

    const updated = await prisma.shipmentLine.findFirst({
      where: { id: line.id, organizationId: context.organizationId },
      select: { pickedQuantity: true, quantity: true },
    });
    const newPicked = Number(updated?.pickedQuantity ?? currentPicked + quantity);

    return {
      picked: quantity,
      remaining: Number(updated?.quantity ?? line.quantity) - newPicked,
      lineId: line.id,
      productName: line.productName,
      newPicked,
    };
  }

  async removePickQuantity(context: AuthenticatedRequestContext, shipmentId: string, lineId: string, quantity: number) {
    const shipment = await this.shipments.findById(context.organizationId, shipmentId);

    if (!shipment) {
      throw new BusinessError("Shipment was not found.", "SHIPMENT_NOT_FOUND");
    }

    if (shipment.status !== "PENDING_PICK" && shipment.status !== "PICKING" && shipment.status !== "PICKED") {
      throw new BusinessError("Shipment is not in picking status.", "SHIPMENT_INVALID_STATUS");
    }

    const line = shipment.lines.find((l) => l.id === lineId);

    if (!line) {
      throw new BusinessError("Shipment line was not found.", "SHIPMENT_LINE_NOT_FOUND");
    }

    if (quantity <= 0) {
      throw new BusinessError("Quantity must be greater than zero.", "SHIPMENT_INVALID_QUANTITY");
    }

    const currentPicked = Number(line.pickedQuantity);

    // Fast-path message only; the conditional UPDATE below is the real guard.
    if (quantity > currentPicked) {
      throw new BusinessError(
        `Cannot remove ${quantity} — only ${currentPicked} picked for this line.`,
        "SHIPMENT_UNDER_PICK",
      );
    }

    const delta = new Prisma.Decimal(quantity);
    const applied = await prisma.$executeRaw`
      UPDATE "shipment_lines"
         SET "pickedQuantity" = "pickedQuantity" - ${delta}
       WHERE "id" = ${line.id}
         AND "organizationId" = ${context.organizationId}
         AND "pickedQuantity" - ${delta} >= 0
    `;

    if (Number(applied) !== 1) {
      const fresh = await prisma.shipmentLine.findFirst({
        where: { id: line.id, organizationId: context.organizationId },
        select: { pickedQuantity: true },
      });
      throw new BusinessError(
        `Cannot remove ${quantity} — only ${Number(fresh?.pickedQuantity ?? 0)} picked for this line.`,
        "SHIPMENT_UNDER_PICK",
      );
    }

    const updated = await prisma.shipmentLine.findFirst({
      where: { id: line.id, organizationId: context.organizationId },
      select: { pickedQuantity: true },
    });
    const newPicked = Number(updated?.pickedQuantity ?? currentPicked - quantity);

    return {
      removed: quantity,
      remaining: newPicked,
      lineId: line.id,
      productName: line.productName,
      newPicked,
    };
  }

  async recomputeShipmentStatus(context: AuthenticatedRequestContext, shipmentId: string) {
    const updated = await this.shipments.findById(context.organizationId, shipmentId);
    if (!updated) return;

    const totalPicked = updated.lines.reduce((sum, l) => sum + Number(l.pickedQuantity), 0);
    const allFullyPicked = updated.lines.every(
      (l) => Number(l.pickedQuantity) >= Number(l.quantity),
    );

    let newStatus: string;
    if (totalPicked === 0) {
      newStatus = "PENDING_PICK";
    } else if (allFullyPicked) {
      newStatus = "PICKED";
    } else {
      newStatus = "PICKING";
    }

    if (newStatus !== updated.status) {
      await this.setStatus(context, updated, newStatus);
    }
  }

  async deliver(context: AuthenticatedRequestContext, id: string) {
    const shipment = await this.shipments.findById(context.organizationId, id);

    if (!shipment) {
      throw new BusinessError("Shipment was not found.", "SHIPMENT_NOT_FOUND");
    }

    if (shipment.status !== "LOADED") {
      throw new BusinessError("Shipment cannot be delivered from its current state.", "SHIPMENT_INVALID_STATUS");
    }

    const allFullyPicked = shipment.lines.every(
      (l) => Number(l.pickedQuantity) >= Number(l.quantity),
    );

    if (!allFullyPicked) {
      throw new BusinessError("Cannot deliver until all lines are fully picked.", "SHIPMENT_NOT_FULLY_PICKED");
    }

    const now = new Date();
    const documentNumber = shipment.shipmentNumber;
    const salesOrderId = shipment.salesOrderId;

    await prisma.$transaction(async (tx) => {
      // Claim the LOADED -> DELIVERED transition FIRST, conditionally. Only one
      // concurrent caller can match `status = 'LOADED'`; the loser aborts the
      // whole transaction before any ledger entry is written, so a shipment can
      // never be posted to inventory twice.
      const claimed = await tx.shipment.updateMany({
        where: { id, organizationId: context.organizationId, status: "LOADED" },
        data: { status: "DELIVERED", deliveredAt: now },
      });

      if (claimed.count !== 1) {
        throw new BusinessError(
          "Shipment cannot be delivered from its current state.",
          "SHIPMENT_INVALID_STATUS",
        );
      }

      const postingLines = shipment.lines.map((line) => {
        return {
          productId: line.productId,
          unitOfMeasureId: line.unitOfMeasureId,
          quantity: line.quantity,
          fromWarehouseId: shipment.warehouseId,
          notes: line.notes,
          ledgerEntries: [
            {
              warehouseId: shipment.warehouseId,
              movementType: "SALE" as const,
              direction: "OUT" as const,
              quantity: line.quantity,
            },
          ],
        };
      });

      const transaction = await this.posting.post(
        {
          organizationId: context.organizationId,
          type: "SALE",
          documentNumber,
          referenceType: "SHIPMENT",
          referenceId: shipment.id,
          occurredAt: now,
          createdById: context.userId,
          notes: `Shipment ${shipment.shipmentNumber}`,
          lines: postingLines,
        },
        tx,
      );

      if (transaction) {
        for (let i = 0; i < shipment.lines.length; i++) {
          const shipLine = shipment.lines[i];
          const invLine = transaction.lines[i];
          if (!invLine) continue;

          for (const entry of invLine.ledgerEntries) {
            if (entry.direction !== "OUT") continue;

            await this.costing.recordIssue(
              {
                organizationId: context.organizationId,
                productId: shipLine.productId,
                warehouseId: shipment.warehouseId,
                quantity: new Prisma.Decimal(Number(shipLine.quantity)),
                ledgerEntryId: entry.id,
              },
              tx,
            );
          }
        }
      }

      // Status was already claimed atomically at the top of this transaction.

      for (const line of shipment.lines) {
        await tx.salesOrderLine.updateMany({
          where: { id: line.salesOrderLineId, organizationId: context.organizationId },
          data: { shippedQuantity: { increment: line.quantity } },
        });
      }

      const updatedLines = await tx.salesOrderLine.findMany({
        where: { salesOrderId, organizationId: context.organizationId },
      });

      const allShipped = updatedLines.every(
        (l) => Number(l.shippedQuantity) >= Number(l.orderedQuantity),
      );

      if (allShipped) {
        await tx.salesOrder.updateMany({
          where: {
            id: salesOrderId,
            organizationId: context.organizationId,
            status: { notIn: ["INVOICED", "PAID"] },
          },
          data: { status: "READY_FOR_INVOICE" },
        });
      }
    });

    await prisma.invoice.updateMany({
      where: { salesOrderId, organizationId: context.organizationId, status: { in: ["ISSUED", "PARTIALLY_PAID"] } },
      data: { deliveryStatus: "Delivered" },
    });

    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "SHIPMENT_DELIVERED",
      entityType: "Shipment",
      entityId: shipment.id,
      summary: `Shipment ${shipment.shipmentNumber} delivered by ${context.user.name} and posted to inventory.`,
      metadata: {
        shipmentNumber: shipment.shipmentNumber,
        salesOrderId,
        warehouseId: shipment.warehouseId,
        lineCount: shipment.lines.length,
      },
    });

    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "SHIPMENT_DELIVERED",
      entityType: "SalesOrder",
      entityId: salesOrderId,
      summary: `Shipment ${shipment.shipmentNumber} was delivered for this order.`,
      metadata: {
        shipmentNumber: shipment.shipmentNumber,
      },
    });

    const invoiceForLog = await prisma.invoice.findFirst({
      where: { salesOrderId, organizationId: context.organizationId, status: { notIn: ["CANCELLED", "DRAFT"] } },
      select: { id: true, invoiceNumber: true },
      orderBy: { createdAt: "desc" },
    });

    if (invoiceForLog) {
      await this.activityLogs.create({
        organizationId: context.organizationId,
        userId: context.userId,
        action: "SHIPMENT_DELIVERED",
        entityType: "Invoice",
        entityId: invoiceForLog.id,
        summary: `Shipment ${shipment.shipmentNumber} was delivered for invoice ${invoiceForLog.invoiceNumber}.`,
        metadata: {
          shipmentNumber: shipment.shipmentNumber,
        },
      });
    }
  }

  private validTransitions: Record<string, string[]> = {
    PENDING_PICK: ["PICKING", "PICKED", "CANCELLED"],
    PICKING: ["PICKED", "PENDING_PICK", "CANCELLED"],
    PICKED: ["LOADED", "CANCELLED"],
    LOADED: ["DELIVERED", "FAILED"],
    DELIVERED: [],
    FAILED: [],
    CANCELLED: [],
  };

  async updateStatus(context: AuthenticatedRequestContext, id: string, status: string) {
    const allowedTargets = ["PICKING", "PICKED", "LOADED", "FAILED", "CANCELLED"];

    if (!allowedTargets.includes(status)) {
      throw new BusinessError(
        `Invalid target status "${status}". Allowed: ${allowedTargets.join(", ")}`,
        "SHIPMENT_INVALID_STATUS",
      );
    }

    const shipment = await this.shipments.findById(context.organizationId, id);

    if (!shipment) {
      throw new BusinessError("Shipment was not found.", "SHIPMENT_NOT_FOUND");
    }

    const allowed = this.validTransitions[shipment.status];
    if (!allowed || !allowed.includes(status)) {
      throw new BusinessError(
        `Cannot transition shipment from ${shipment.status} to ${status}.`,
        "SHIPMENT_INVALID_TRANSITION",
      );
    }

    await this.shipments.updateStatus(context.organizationId, id, status as never);

    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: `SHIPMENT_${status}`,
      entityType: "Shipment",
      entityId: id,
      summary: `Shipment ${shipment.shipmentNumber} status changed to ${status} by ${context.user.name}.`,
      metadata: { shipmentNumber: shipment.shipmentNumber, previousStatus: shipment.status, newStatus: status },
    });
  }

  private async setStatus(context: AuthenticatedRequestContext, shipment: { id: string; shipmentNumber: string; status: string }, status: string) {
    await this.shipments.updateStatus(context.organizationId, shipment.id, status as never);

    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: `SHIPMENT_${status}`,
      entityType: "Shipment",
      entityId: shipment.id,
      summary: `Shipment ${shipment.shipmentNumber} status changed to ${status} by ${context.user.name}.`,
      metadata: { shipmentNumber: shipment.shipmentNumber, previousStatus: shipment.status, newStatus: status },
    });
  }
}
