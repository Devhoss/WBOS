import { Prisma } from "@prisma/client";

import { ActivityLogRepository } from "@/domains/activity/repositories/activity-log-repository";
import { DocumentNumberService } from "@/domains/documents/services/document-number-service";
import { prisma } from "@/infrastructure/database/prisma";
import type { AuthenticatedRequestContext } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { InvoiceRepository } from "../repositories/invoice-repository";
import { SalesOrderRepository } from "../repositories/sales-order-repository";

const deliveryStatusFromShipment: Record<string, string> = {
  PENDING_PICK: "Pending Pick",
  PICKING: "Picking",
  PICKED: "Picked",
  LOADED: "Loaded",
  OUT_FOR_DELIVERY: "Out for Delivery",
  DELIVERED: "Delivered",
  FAILED: "Failed",
};

export class InvoiceService {
  constructor(
    private readonly invoices = new InvoiceRepository(),
    private readonly orders = new SalesOrderRepository(),
    private readonly documents = new DocumentNumberService(),
    private readonly activityLogs = new ActivityLogRepository(),
  ) {}

  async generateFromOrder(context: AuthenticatedRequestContext, salesOrderId: string) {
    const order = await this.orders.findById(context.organizationId, salesOrderId);

    if (!order) {
      throw new BusinessError("Sales order was not found.", "SALES_ORDER_NOT_FOUND");
    }

    if (order.status !== "READY_FOR_INVOICE" && order.status !== "APPROVED") {
      throw new BusinessError(
        "Invoice can only be generated for orders that are ready for invoicing.",
        "SALES_NOT_READY_FOR_INVOICE",
      );
    }

    const existingInvoice = order.invoices?.[0];

    if (existingInvoice && existingInvoice.status !== "CANCELLED") {
      throw new BusinessError(
        "An active invoice already exists for this sales order.",
        "SALES_INVOICE_EXISTS",
      );
    }

    const shipments = order.shipments ?? [];
    // shipments are ordered by createdAt DESC; [0] is the most recent
    const latestShipment = shipments.length > 0 ? shipments[0] : null;
    const warehouseName = latestShipment?.warehouse?.name ?? null;
    const shipmentStatus = latestShipment?.status ?? null;
    const deliveryStatus = shipmentStatus ? (deliveryStatusFromShipment[shipmentStatus] ?? null) : null;

    const now = new Date();
    const { documentNumber } = await this.documents.generate({
      organizationId: context.organizationId,
      documentType: "INV",
      year: now.getFullYear(),
      prefix: "INV",
    });

    const customer = order.customer;
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + 30);

    const discountAmount = new Prisma.Decimal(order.discountAmount);
    const hasDiscount = discountAmount.gt(0);

    const invoice = await this.invoices.create(context.organizationId, documentNumber, {
      salesOrderId: order.id,
      customerId: customer.id,
      currency: order.currency,
      subtotal: new Prisma.Decimal(order.subtotal),
      taxAmount: new Prisma.Decimal(order.taxAmount),
      totalAmount: new Prisma.Decimal(order.totalAmount),
      discountAmount,
      discountType: hasDiscount ? "FIXED" : null,
      discountRate: hasDiscount ? discountAmount : null,
      customerName: customer.name,
      customerAddress: customer.address,
      paymentTerms: order.notes ?? null,
      dueDate,
      notes: order.notes ?? null,
      warehouseName,
      deliveryStatus,
      lines: await Promise.all(order.lines.map(async (line, index) => {
        let piecesPerBox = line.piecesPerBox ? new Prisma.Decimal(line.piecesPerBox) : null;

        if (!piecesPerBox) {
          const product = await prisma.product.findFirst({
            where: { id: line.productId, organizationId: context.organizationId },
            select: { piecesPerBox: true },
          });
          if (product?.piecesPerBox) {
            piecesPerBox = new Prisma.Decimal(product.piecesPerBox);
          }
        }

        return {
          organizationId: context.organizationId,
          salesOrderLineId: line.id,
          productId: line.productId,
          unitOfMeasureId: line.unitOfMeasureId,
          lineNumber: index + 1,
          quantity: new Prisma.Decimal(line.orderedQuantity),
          unitPrice: new Prisma.Decimal(line.unitPrice),
          totalPrice: new Prisma.Decimal(line.totalPrice),
          productName: line.productName,
          productSku: line.productSku,
          unitOfMeasureCode: line.unitOfMeasureCode,
          piecesPerBox,
          description: line.description,
        };
      })),
    });

    await this.orders.updateStatus(context.organizationId, order.id, "INVOICED");

    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "INVOICE_ISSUED",
      entityType: "Invoice",
      entityId: invoice.id,
      summary: `Invoice ${documentNumber} generated for sales order ${order.soNumber}.`,
      metadata: {
        invoiceNumber: documentNumber,
        salesOrderId: order.id,
        soNumber: order.soNumber,
        totalAmount: Number(order.totalAmount),
      },
    });

    return invoice;
  }
}
