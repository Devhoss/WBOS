import { type ShipmentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/infrastructure/database/prisma";
import { BusinessError } from "@/shared/errors/business-error";
import { DocumentNumberService } from "@/domains/documents/services/document-number-service";
import { ReturnOrderRepository } from "../repositories/return-order-repository";
import { InventoryPostingService } from "@/domains/inventory/services/inventory-posting-service";
import { ActivityLogRepository } from "@/domains/activity/repositories/activity-log-repository";
import { CreditNoteService } from "@/domains/credit-notes/services/credit-note-service";
import type { CreateReturnOrderInput, CompleteReturnInput } from "../validation/return-order-schema";

export class ReturnOrderService {
  private repo = new ReturnOrderRepository();
  private docs = new DocumentNumberService();
  private logs = new ActivityLogRepository();
  private inventory = new InventoryPostingService();
  private creditNotes = new CreditNoteService();

  async create(context: { organizationId: string; userId: string }, input: CreateReturnOrderInput) {
    const now = new Date();
    const { documentNumber } = await this.docs.generate({
      organizationId: context.organizationId,
      documentType: "RN",
      year: now.getFullYear(),
      prefix: "RN",
    });

    let resolvedInvoiceId = input.invoiceId;
    let salesOrderIdForValidation = input.salesOrderId;

    if (input.salesOrderId) {
      await this.validateReturnableQuantities(context.organizationId, input.salesOrderId, input.lines);
      if (!input.invoiceId) {
        const soInvoice = await prisma.invoice.findFirst({
          where: { salesOrderId: input.salesOrderId, organizationId: context.organizationId, status: { notIn: ["CANCELLED", "DRAFT"] } },
          select: { id: true },
          orderBy: { createdAt: "desc" },
        });
        if (soInvoice) {
          resolvedInvoiceId = soInvoice.id;
        }
      }
    }

    if (input.invoiceId && !input.salesOrderId) {
      const invoice = await prisma.invoice.findFirst({
        where: { id: input.invoiceId, organizationId: context.organizationId },
        select: { salesOrderId: true },
      });
      if (invoice?.salesOrderId) {
        salesOrderIdForValidation = invoice.salesOrderId;
        await this.validateReturnableQuantities(context.organizationId, invoice.salesOrderId, input.lines);
      }
    }

    const createInput = {
      customerId: input.customerId,
      salesOrderId: salesOrderIdForValidation || undefined,
      invoiceId: resolvedInvoiceId || undefined,
      reason: input.reason,
      notes: input.notes,
      lines: input.lines.map((line, index) => ({
        ...line,
        lineNumber: index + 1,
      })),
    };

    const returnOrder = await this.repo.create(
      context.organizationId,
      documentNumber,
      context.userId,
      createInput,
    );

    await this.logs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "RETURN_CREATED",
      entityType: "ReturnOrder",
      entityId: returnOrder.id,
      summary: `Return ${returnOrder.returnNumber} was created.`,
      metadata: { returnNumber: returnOrder.returnNumber, reason: input.reason },
    });

    if (returnOrder.salesOrder) {
      await this.logs.create({
        organizationId: context.organizationId,
        userId: context.userId,
        action: "RETURN_CREATED",
        entityType: "SalesOrder",
        entityId: returnOrder.salesOrder.id,
        summary: `Return ${returnOrder.returnNumber} was created for this order.`,
        metadata: { returnNumber: returnOrder.returnNumber, reason: input.reason },
      });
    }

    if (returnOrder.invoice) {
      await this.logs.create({
        organizationId: context.organizationId,
        userId: context.userId,
        action: "RETURN_CREATED",
        entityType: "Invoice",
        entityId: returnOrder.invoice.id,
        summary: `Return ${returnOrder.returnNumber} was created for this invoice.`,
        metadata: { returnNumber: returnOrder.returnNumber, reason: input.reason },
      });
    }

    return returnOrder;
  }

  private async guardDeliveredShipmentExists(organizationId: string, salesOrderId: string): Promise<void> {
    const delivered = await prisma.shipment.findFirst({
      where: { salesOrderId, organizationId, status: "DELIVERED" },
      select: { id: true },
    });
    if (!delivered) {
      throw new BusinessError(
        "This order has no delivered shipments. Cancel the order instead of creating a return.",
        "RETURN_NO_DELIVERED_SHIPMENT",
      );
    }
  }

  private async validateReturnableQuantities(
    organizationId: string,
    salesOrderId: string,
    lines: Array<{ productId: string; expectedQuantity: number }>,
  ) {
    await this.guardDeliveredShipmentExists(organizationId, salesOrderId);

    const soLines = await prisma.salesOrderLine.findMany({
      where: { salesOrderId, organizationId },
      select: { productId: true, shippedQuantity: true, returnedQuantity: true },
    });

    for (const line of lines) {
      const matching = soLines.filter((sl) => sl.productId === line.productId);

      if (matching.length === 0) {
        throw new BusinessError(
          `Product is not part of this sales order. Only products from the original order can be returned.`,
          "RETURN_PRODUCT_NOT_IN_SO",
        );
      }

      const totalShipped = matching.reduce((s, sl) => s + Number(sl.shippedQuantity), 0);
      const totalReturned = matching.reduce((s, sl) => s + Number(sl.returnedQuantity), 0);
      const available = totalShipped - totalReturned;

      if (line.expectedQuantity > available) {
        if (totalShipped === 0) {
          throw new BusinessError(
            `Product has not been shipped. Cancel the order instead of creating a return.`,
            "RETURN_NOT_SHIPPED",
          );
        }
        throw new BusinessError(
          `Cannot return ${line.expectedQuantity} — only ${available} remaining after previous returns.`,
          "RETURN_EXCEEDS_AVAILABLE",
        );
      }
    }
  }

  async receive(
    context: { organizationId: string; userId: string },
    id: string,
    lines: Array<{ lineId: string; receivedQuantity: number; condition?: string }>,
  ) {
    const returnOrder = await this.repo.findById(context.organizationId, id);

    if (!returnOrder) {
      throw new BusinessError("Return was not found.", "RETURN_NOT_FOUND");
    }

    if (returnOrder.status !== "OPEN") {
      throw new BusinessError("Only open returns can receive goods.", "RETURN_INVALID_STATUS");
    }

    for (const line of lines) {
      await this.repo.updateLine(context.organizationId, line.lineId, {
        receivedQuantity: line.receivedQuantity,
        condition: line.condition,
      });
    }

    await this.repo.updateStatus(context.organizationId, id, "RECEIVED");

    await this.logs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "RETURN_RECEIVED",
      entityType: "ReturnOrder",
      entityId: id,
      summary: `Return ${returnOrder.returnNumber} was received.`,
      metadata: { returnNumber: returnOrder.returnNumber },
    });

    if (returnOrder.salesOrder) {
      await this.logs.create({
        organizationId: context.organizationId,
        userId: context.userId,
        action: "RETURN_RECEIVED",
        entityType: "SalesOrder",
        entityId: returnOrder.salesOrder.id,
        summary: `Return ${returnOrder.returnNumber} was received for this order.`,
        metadata: { returnNumber: returnOrder.returnNumber },
      });
    }

    if (returnOrder.invoice) {
      await this.logs.create({
        organizationId: context.organizationId,
        userId: context.userId,
        action: "RETURN_RECEIVED",
        entityType: "Invoice",
        entityId: returnOrder.invoice.id,
        summary: `Return ${returnOrder.returnNumber} was received for this invoice.`,
        metadata: { returnNumber: returnOrder.returnNumber },
      });
    }

    return this.repo.findById(context.organizationId, id);
  }

  async complete(
    context: { organizationId: string; userId: string },
    input: CompleteReturnInput,
  ) {
    const returnOrder = await this.repo.findById(context.organizationId, input.id);

    if (!returnOrder) {
      throw new BusinessError("Return was not found.", "RETURN_NOT_FOUND");
    }

    if (returnOrder.status !== "RECEIVED") {
      throw new BusinessError("Only received returns can be completed.", "RETURN_INVALID_STATUS");
    }

    await this.guardReturnStillValid(context.organizationId, returnOrder);

    const warehouse = await prisma.warehouse.findFirst({
      where: { organizationId: context.organizationId, id: input.warehouseId },
    });
    if (!warehouse) {
      throw new BusinessError("Warehouse not found. Please select a valid warehouse.", "RETURN_WAREHOUSE_NOT_FOUND");
    }

    const now = new Date();

    for (const line of input.lines) {
      const orderLine = returnOrder.lines.find((l) => l.id === line.lineId);
      if (!orderLine) {
        throw new BusinessError(`Return line ${line.lineId} was not found.`, "RETURN_LINE_NOT_FOUND");
      }

      await this.repo.updateLine(context.organizationId, line.lineId, {
        disposition: line.disposition,
        condition: line.condition,
      });

      if (line.disposition === "RESTOCK") {
        await this.inventory.post({
          organizationId: context.organizationId,
          type: "CUSTOMER_RETURN",
          referenceType: "ReturnOrder",
          referenceId: input.id,
          occurredAt: now,
          createdById: context.userId,
          notes: `Restock from return ${returnOrder.returnNumber}`,
          lines: [{
            productId: orderLine.productId,
            unitOfMeasureId: orderLine.unitOfMeasureId,
            quantity: orderLine.receivedQuantity,
            toWarehouseId: input.warehouseId,
            ledgerEntries: [{
              warehouseId: input.warehouseId,
              movementType: "CUSTOMER_RETURN",
              direction: "IN",
              quantity: orderLine.receivedQuantity,
            }],
          }],
        });

        await this.logs.create({
          organizationId: context.organizationId,
          userId: context.userId,
          action: "INVENTORY_RESTOCKED",
          entityType: "InventoryTransaction",
          entityId: input.id,
          summary: `Product restocked from return ${returnOrder.returnNumber}.`,
          metadata: { returnNumber: returnOrder.returnNumber, productId: orderLine.productId },
        });
      }

      if (line.disposition === "SCRAP") {
        await this.inventory.post({
          organizationId: context.organizationId,
          type: "CUSTOMER_RETURN",
          referenceType: "ReturnOrder",
          referenceId: input.id,
          occurredAt: now,
          createdById: context.userId,
          notes: `Scrap from return ${returnOrder.returnNumber}`,
          lines: [{
            productId: orderLine.productId,
            unitOfMeasureId: orderLine.unitOfMeasureId,
            quantity: orderLine.receivedQuantity,
            toWarehouseId: input.warehouseId,
            ledgerEntries: [{
              warehouseId: input.warehouseId,
              movementType: "CUSTOMER_RETURN",
              direction: "IN",
              quantity: orderLine.receivedQuantity,
            }],
          }],
        });

        await this.inventory.post({
          organizationId: context.organizationId,
          type: "DAMAGE",
          referenceType: "ReturnOrder",
          referenceId: input.id,
          occurredAt: now,
          createdById: context.userId,
          notes: `Scrap disposal from return ${returnOrder.returnNumber}`,
          lines: [{
            productId: orderLine.productId,
            unitOfMeasureId: orderLine.unitOfMeasureId,
            quantity: orderLine.receivedQuantity,
            fromWarehouseId: input.warehouseId,
            ledgerEntries: [{
              warehouseId: input.warehouseId,
              movementType: "DAMAGE",
              direction: "OUT",
              quantity: orderLine.receivedQuantity,
            }],
          }],
        });

        await this.logs.create({
          organizationId: context.organizationId,
          userId: context.userId,
          action: "INVENTORY_SCRAPPED",
          entityType: "InventoryTransaction",
          entityId: input.id,
          summary: `Product scrapped from return ${returnOrder.returnNumber}.`,
          metadata: { returnNumber: returnOrder.returnNumber, productId: orderLine.productId },
        });
      }

      if (line.disposition === "REPLACE") {
        await this.createReplacementShipment(context, returnOrder, orderLine, input.warehouseId);
      }
    }

    if (returnOrder.salesOrder) {
      await this.updateReturnedQuantities(
        context.organizationId,
        returnOrder.salesOrder.id,
        input.lines.map((l) => {
          const ol = returnOrder.lines.find((rl) => rl.id === l.lineId);
          return { productId: ol?.productId ?? "", receivedQuantity: Number(ol?.receivedQuantity ?? 0) };
        }),
      );
    } else if (returnOrder.invoice) {
      const invoice = await prisma.invoice.findFirst({
        where: { id: returnOrder.invoice.id, organizationId: context.organizationId },
        select: { salesOrderId: true },
      });
      if (invoice?.salesOrderId) {
        await this.updateReturnedQuantities(
          context.organizationId,
          invoice.salesOrderId,
          input.lines.map((l) => {
            const ol = returnOrder.lines.find((rl) => rl.id === l.lineId);
            return { productId: ol?.productId ?? "", receivedQuantity: Number(ol?.receivedQuantity ?? 0) };
          }),
        );
      }
    }

    await this.logs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "RETURN_COMPLETED",
      entityType: "ReturnOrder",
      entityId: input.id,
      summary: `Return ${returnOrder.returnNumber} was completed.`,
      metadata: { returnNumber: returnOrder.returnNumber },
    });

    if (returnOrder.salesOrder) {
      await this.logs.create({
        organizationId: context.organizationId,
        userId: context.userId,
        action: "RETURN_COMPLETED",
        entityType: "SalesOrder",
        entityId: returnOrder.salesOrder.id,
        summary: `Return ${returnOrder.returnNumber} was completed for this order.`,
        metadata: { returnNumber: returnOrder.returnNumber },
      });
    }

    if (returnOrder.invoice) {
      await this.logs.create({
        organizationId: context.organizationId,
        userId: context.userId,
        action: "RETURN_COMPLETED",
        entityType: "Invoice",
        entityId: returnOrder.invoice.id,
        summary: `Return ${returnOrder.returnNumber} was completed for this invoice.`,
        metadata: { returnNumber: returnOrder.returnNumber },
      });
    }

    if (returnOrder.invoice) {
      const dispositionByLineId = new Map(input.lines.map((l) => [l.lineId, l.disposition]));
      await this.creditNotes.issueFromReturn(context, {
        id: returnOrder.id,
        returnNumber: returnOrder.returnNumber,
        customerId: returnOrder.customerId,
        invoice: returnOrder.invoice,
        lines: returnOrder.lines.map((l) => ({
          id: l.id,
          productId: l.productId,
          unitOfMeasureId: l.unitOfMeasureId,
          invoiceLineId: l.invoiceLineId,
          receivedQuantity: l.receivedQuantity,
          unitPrice: l.unitPrice,
          disposition: dispositionByLineId.get(l.id) ?? null,
        })),
      });
    }

    await this.repo.updateStatus(context.organizationId, input.id, "COMPLETED", { completedAt: now });

    return this.repo.findById(context.organizationId, input.id);
  }

  private async guardReturnStillValid(
    organizationId: string,
    returnOrder: { salesOrderId: string | null; invoiceId: string | null; lines: Array<{ productId: string; receivedQuantity: number | Prisma.Decimal }> },
  ): Promise<void> {
    const salesOrderId = returnOrder.salesOrderId
      ?? (returnOrder.invoiceId
        ? (await prisma.invoice.findFirst({ where: { id: returnOrder.invoiceId, organizationId }, select: { salesOrderId: true } }))?.salesOrderId
        : null);

    if (salesOrderId) {
      await this.guardDeliveredShipmentExists(organizationId, salesOrderId);

      const soLines = await prisma.salesOrderLine.findMany({
        where: { salesOrderId, organizationId },
        select: { productId: true, shippedQuantity: true, returnedQuantity: true },
      });

      for (const line of returnOrder.lines) {
        const rcvQty = Number(line.receivedQuantity);
        if (rcvQty <= 0) continue;

        const matching = soLines.filter((sl) => sl.productId === line.productId);
        if (matching.length === 0) {
          throw new BusinessError(
            `Product is not part of this sales order. Cannot complete return.`,
            "RETURN_PRODUCT_NOT_IN_SO",
          );
        }

        const totalShipped = matching.reduce((s, sl) => s + Number(sl.shippedQuantity), 0);
        const totalReturned = matching.reduce((s, sl) => s + Number(sl.returnedQuantity), 0);
        const available = totalShipped - totalReturned;

        if (rcvQty > available) {
          throw new BusinessError(
            `Cannot complete return — only ${available} of product remaining after previous returns.`,
            "RETURN_EXCEEDS_AVAILABLE",
          );
        }
      }
    }
  }

  private async updateReturnedQuantities(
    organizationId: string,
    salesOrderId: string,
    lines: Array<{ productId: string; receivedQuantity: number }>,
  ) {
    for (const line of lines) {
      if (!line.productId || line.receivedQuantity <= 0) continue;

      await prisma.salesOrderLine.updateMany({
        where: {
          organizationId,
          salesOrderId,
          productId: line.productId,
        },
        data: {
          returnedQuantity: { increment: line.receivedQuantity },
        },
      });
    }
  }

  private async createReplacementShipment(
    context: { organizationId: string; userId: string },
    returnOrder: { id: string; returnNumber: string; salesOrderId: string | null; lines: Array<{ id: string; productId: string; unitOfMeasureId: string; receivedQuantity: Prisma.Decimal | number }> },
    orderLine: { id: string; productId: string; unitOfMeasureId: string; receivedQuantity: Prisma.Decimal | number },
    warehouseId: string,
  ) {
    const salesOrderId = returnOrder.salesOrderId;
    if (!salesOrderId) {
      throw new BusinessError(
        "Cannot create replacement: Return is not linked to a sales order.",
        "RETURN_NO_SALES_ORDER",
      );
    }

    const now = new Date();
    const { documentNumber: shipmentNumber } = await this.docs.generate({
      organizationId: context.organizationId,
      documentType: "SHP",
      year: now.getFullYear(),
      prefix: "SHP",
    });

    const [product, soLine] = await Promise.all([
      prisma.product.findFirst({
        where: { id: orderLine.productId },
        select: { name: true, sku: true },
      }),
      prisma.salesOrderLine.findFirst({
        where: { salesOrderId, productId: orderLine.productId },
        select: { id: true },
      }),
    ]);

    if (!soLine) {
      throw new BusinessError(
        "Cannot create replacement: Original sales order line not found for this product.",
        "RETURN_NO_SO_LINE",
      );
    }

    const shipment = await prisma.shipment.create({
      data: {
        organizationId: context.organizationId,
        shipmentNumber,
        salesOrderId,
        warehouseId,
        status: "PENDING_PICK" as ShipmentStatus,
        notes: `Replacement shipment for return ${returnOrder.returnNumber}`,
        createdById: context.userId,
        lines: {
          create: [{
            organizationId: context.organizationId,
            salesOrderLineId: soLine.id,
            productId: orderLine.productId,
            quantity: new Prisma.Decimal(orderLine.receivedQuantity),
            productName: product?.name ?? "",
            productSku: product?.sku ?? "",
          }],
        },
      },
      include: {
        lines: true,
      },
    }) as unknown as { id: string; lines: Array<{ id: string }> };

    const shipmentLines = shipment.lines;

    const { documentNumber: taskNumber } = await this.docs.generate({
      organizationId: context.organizationId,
      documentType: "TSK",
      year: now.getFullYear(),
      prefix: "TSK",
    });

    await prisma.task.create({
      data: {
        organizationId: context.organizationId,
        taskNumber,
        type: "PICK_ORDER",
        status: "ASSIGNED",
        priority: "HIGH",
        title: `Pick replacement for return ${returnOrder.returnNumber}`,
        subtitle: `Replacement shipment ${shipmentNumber}`,
        referenceType: "SALES_ORDER",
        referenceId: salesOrderId,
        warehouseId,
        assignedToId: context.userId,
        createdById: context.userId,
        data: { returnOrderId: returnOrder.id, shipmentId: shipment.id },
        lines: {
          create: shipmentLines.map((line, index) => ({
            organizationId: context.organizationId,
            referenceLineId: line.id,
            sortOrder: index + 1,
          })),
        },
      },
    });

    await this.logs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "SHIPMENT_CREATED",
      entityType: "Shipment",
      entityId: shipment.id,
      summary: `Replacement shipment ${shipmentNumber} created for return ${returnOrder.returnNumber}.`,
      metadata: { returnNumber: returnOrder.returnNumber, shipmentNumber },
    });
  }

  async cancel(
    context: { organizationId: string; userId: string },
    id: string,
    reason?: string,
  ) {
    const returnOrder = await this.repo.findById(context.organizationId, id);

    if (!returnOrder) {
      throw new BusinessError("Return was not found.", "RETURN_NOT_FOUND");
    }

    if (returnOrder.status === "COMPLETED" || returnOrder.status === "CANCELLED") {
      throw new BusinessError("This return cannot be cancelled.", "RETURN_CANNOT_CANCEL");
    }

    await this.repo.updateStatus(context.organizationId, id, "CANCELLED", {
      cancelledAt: new Date(),
      cancelledReason: reason,
    });

    await this.logs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "RETURN_CANCELLED",
      entityType: "ReturnOrder",
      entityId: id,
      summary: `Return ${returnOrder.returnNumber} was cancelled.`,
      metadata: { returnNumber: returnOrder.returnNumber, reason },
    });

    if (returnOrder.salesOrder) {
      await this.logs.create({
        organizationId: context.organizationId,
        userId: context.userId,
        action: "RETURN_CANCELLED",
        entityType: "SalesOrder",
        entityId: returnOrder.salesOrder.id,
        summary: `Return ${returnOrder.returnNumber} was cancelled for this order.`,
        metadata: { returnNumber: returnOrder.returnNumber, reason },
      });
    }

    if (returnOrder.invoice) {
      await this.logs.create({
        organizationId: context.organizationId,
        userId: context.userId,
        action: "RETURN_CANCELLED",
        entityType: "Invoice",
        entityId: returnOrder.invoice.id,
        summary: `Return ${returnOrder.returnNumber} was cancelled for this invoice.`,
        metadata: { returnNumber: returnOrder.returnNumber, reason },
      });
    }
  }

  async list(organizationId: string, pageSize = 50) {
    return this.repo.list(organizationId, pageSize);
  }

  async findById(organizationId: string, id: string) {
    return this.repo.findById(organizationId, id);
  }
}
