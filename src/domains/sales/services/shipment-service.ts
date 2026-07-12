import { Prisma } from "@prisma/client";

import { ActivityLogRepository } from "@/domains/activity/repositories/activity-log-repository";
import { DocumentNumberService } from "@/domains/documents/services/document-number-service";
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

    for (const line of input.lines) {
      const soLine = order.lines.find((l) => l.id === line.salesOrderLineId);

      if (!soLine) {
        throw new BusinessError("Sales order line was not found.", "SALES_LINE_NOT_FOUND");
      }

      const remaining = Number(soLine.orderedQuantity) - Number(soLine.shippedQuantity);

      if (Number(line.quantity) > remaining) {
        throw new BusinessError(
          `Shipping quantity exceeds the remaining order quantity (${remaining.toFixed(3)}).`,
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
      summary: `Shipment ${documentNumber} created for sales order ${order.soNumber}.`,
      metadata: {
        shipmentNumber: documentNumber,
        salesOrderId: order.id,
        soNumber: order.soNumber,
        warehouseId: warehouse.id,
        lineCount: input.lines.length,
      },
    });

    return shipment;
  }

  async scanPick(context: AuthenticatedRequestContext, shipmentId: string, barcode: string) {
    const shipment = await this.shipments.findById(context.organizationId, shipmentId);

    if (!shipment) {
      throw new BusinessError("Shipment was not found.", "SHIPMENT_NOT_FOUND");
    }

    if (shipment.status !== "PENDING_PICK" && shipment.status !== "PICKING") {
      throw new BusinessError("Shipment is not in picking status.", "SHIPMENT_INVALID_STATUS");
    }

    const line = shipment.lines.find(
      (l) => l.product?.barcode === barcode && new Prisma.Decimal(l.pickedQuantity).lt(new Prisma.Decimal(l.quantity)),
    );

    if (!line) {
      const alreadyFullyPicked = shipment.lines.some(
        (l) => l.product?.barcode === barcode && new Prisma.Decimal(l.pickedQuantity).gte(new Prisma.Decimal(l.quantity)),
      );

      if (alreadyFullyPicked) {
        throw new BusinessError("This product is already fully picked.", "SHIPMENT_ALREADY_PICKED");
      }

      throw new BusinessError("No unpicked line matches this barcode.", "SHIPMENT_BARCODE_MISMATCH");
    }

    const remaining = Number(line.quantity) - Number(line.pickedQuantity);
    const scanning = Math.min(1, remaining);

    await this.shipments.incrementPickedQuantity(context.organizationId, line.id);

    if (shipment.status === "PENDING_PICK") {
      await this.setStatus(context, shipment, "PICKING");
    }

    const updatedShipment = await this.shipments.findById(context.organizationId, shipmentId);

    const allFullyPicked = updatedShipment!.lines.every(
      (l) => Number(l.pickedQuantity) >= Number(l.quantity),
    );

    if (allFullyPicked) {
      await this.setStatus(context, updatedShipment!, "PICKED");
    }

    return {
      picked: scanning,
      remaining: remaining - scanning,
      lineId: line.id,
      productName: line.productName,
    };
  }

  async addPickQuantity(context: AuthenticatedRequestContext, shipmentId: string, lineId: string, quantity: number) {
    const shipment = await this.shipments.findById(context.organizationId, shipmentId);

    if (!shipment) {
      throw new BusinessError("Shipment was not found.", "SHIPMENT_NOT_FOUND");
    }

    if (shipment.status !== "PENDING_PICK" && shipment.status !== "PICKING") {
      throw new BusinessError("Shipment is not in picking status.", "SHIPMENT_INVALID_STATUS");
    }

    const line = shipment.lines.find((l) => l.id === lineId);

    if (!line) {
      throw new BusinessError("Shipment line was not found.", "SHIPMENT_LINE_NOT_FOUND");
    }

    if (quantity <= 0) {
      throw new BusinessError("Quantity must be greater than zero.", "SHIPMENT_INVALID_QUANTITY");
    }

    const remaining = Number(line.quantity) - Number(line.pickedQuantity);

    if (quantity > remaining) {
      throw new BusinessError(
        `Cannot pick ${quantity} — only ${remaining} remaining for this line.`,
        "SHIPMENT_OVER_PICK",
      );
    }

    await this.shipments.addPickedQuantity(context.organizationId, line.id, quantity);

    if (shipment.status === "PENDING_PICK") {
      await this.setStatus(context, shipment, "PICKING");
    }

    const updatedShipment = await this.shipments.findById(context.organizationId, shipmentId);

    const allFullyPicked = updatedShipment!.lines.every(
      (l) => Number(l.pickedQuantity) >= Number(l.quantity),
    );

    if (allFullyPicked) {
      await this.setStatus(context, updatedShipment!, "PICKED");
    }

    return {
      picked: quantity,
      remaining: remaining - quantity,
      lineId: line.id,
      productName: line.productName,
    };
  }

  async deliver(context: AuthenticatedRequestContext, id: string) {
    const shipment = await this.shipments.findById(context.organizationId, id);

    if (!shipment) {
      throw new BusinessError("Shipment was not found.", "SHIPMENT_NOT_FOUND");
    }

    if (shipment.status !== "LOADED" && shipment.status !== "OUT_FOR_DELIVERY") {
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
      const postingLines = await Promise.all(
        shipment.lines.map(async (line) => {
          const product = await tx.product.findFirst({
            where: { id: line.productId, organizationId: context.organizationId },
            select: { unitOfMeasureId: true },
          });

          return {
            productId: line.productId,
            unitOfMeasureId: product?.unitOfMeasureId ?? "",
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
        }),
      );

      await this.posting.post(
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

      await tx.shipment.updateMany({
        where: { id, organizationId: context.organizationId },
        data: { status: "DELIVERED", deliveredAt: now },
      });

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
      summary: `Shipment ${shipment.shipmentNumber} delivered and posted to inventory.`,
      metadata: {
        shipmentNumber: shipment.shipmentNumber,
        salesOrderId,
        warehouseId: shipment.warehouseId,
        lineCount: shipment.lines.length,
      },
    });
  }

  async updateStatus(context: AuthenticatedRequestContext, id: string, status: string) {
    const allowedStatuses = ["PICKING", "PICKED", "LOADED", "OUT_FOR_DELIVERY", "FAILED"];

    if (!allowedStatuses.includes(status)) {
      throw new BusinessError("Invalid shipment status transition.", "SHIPMENT_INVALID_STATUS");
    }

    const shipment = await this.shipments.findById(context.organizationId, id);

    if (!shipment) {
      throw new BusinessError("Shipment was not found.", "SHIPMENT_NOT_FOUND");
    }

    await this.shipments.updateStatus(context.organizationId, id, status as never);

    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: `SHIPMENT_${status}`,
      entityType: "Shipment",
      entityId: id,
      summary: `Shipment ${shipment.shipmentNumber} status changed to ${status}.`,
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
      summary: `Shipment ${shipment.shipmentNumber} status changed to ${status}.`,
      metadata: { shipmentNumber: shipment.shipmentNumber, previousStatus: shipment.status, newStatus: status },
    });
  }
}
