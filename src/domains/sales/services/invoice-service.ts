import { Prisma } from "@prisma/client";

import { ActivityLogRepository } from "@/domains/activity/repositories/activity-log-repository";
import { DocumentNumberService } from "@/domains/documents/services/document-number-service";
import { prisma } from "@/infrastructure/database/prisma";
import type { AuthenticatedRequestContext } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";
import { calculateDocumentTotals } from "@/shared/money/document-totals";

import { InvoiceRepository } from "../repositories/invoice-repository";
import { SalesOrderRepository } from "../repositories/sales-order-repository";

const deliveryStatusFromShipment: Record<string, string> = {
  PENDING_PICK: "Pending Pick",
  PICKING: "Picking",
  PICKED: "Picked",
  LOADED: "Loaded",

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

    // The invoice header is derived from the invoice's OWN lines, not copied
    // from the order. The two used to be independent arithmetics — the header
    // was copied verbatim while FREE_SAMPLE lines were separately zeroed — so
    // any disagreement on the order propagated onto a printed invoice that then
    // did not foot against the lines beneath it. Legacy orders written before
    // the totals became server-authoritative can carry exactly such a
    // disagreement (SO-2026-000002 stores 72.913 where its own figures give
    // 72.912), and a newly generated invoice must not inherit it.
    //
    // Nothing is rejected here: an invoice is server-generated output, not
    // client input. The order's tax and discount remain the authoritative
    // inputs; only the derived money is recomputed.
    const invoiceLines = await Promise.all(order.lines.map(async (line, index) => {
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

        const isFreeSample = line.lineType === "FREE_SAMPLE";
        const unitPrice = isFreeSample ? new Prisma.Decimal(0) : new Prisma.Decimal(line.unitPrice);
        const totalPrice = isFreeSample ? new Prisma.Decimal(0) : new Prisma.Decimal(line.totalPrice);

        return {
          organizationId: context.organizationId,
          salesOrderLineId: line.id,
          productId: line.productId,
          unitOfMeasureId: line.unitOfMeasureId,
          lineNumber: index + 1,
          quantity: new Prisma.Decimal(line.orderedQuantity),
          unitPrice,
          totalPrice,
          lineType: line.lineType ?? "NORMAL",
          productName: line.productName,
          productArabicName: line.productArabicName ?? null,
          productSku: line.productSku,
          unitOfMeasureCode: line.unitOfMeasureCode,
          piecesPerBox,
          description: line.description,
        };
      }));

    // Derived from the invoice's own lines, using the order's tax and discount
    // as inputs. `calculateDocumentTotals` re-applies the free-sample rule, so
    // the zeroing above and the header can never disagree.
    const totals = calculateDocumentTotals({
      lines: invoiceLines.map((l) => ({
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        lineType: l.lineType as "NORMAL" | "FREE_SAMPLE",
      })),
      taxAmount: order.taxAmount,
      // A percentage discount was already resolved to an amount on the order,
      // so the invoice carries it as a FIXED amount — the existing behaviour.
      discountType: Number(order.discountAmount) > 0 ? "FIXED" : null,
      discountRate: order.discountAmount,
    });

    const discountAmount = new Prisma.Decimal(totals.discountAmount.toFixed(3));
    const hasDiscount = discountAmount.gt(0);

    const invoice = await this.invoices.create(context.organizationId, documentNumber, {
      salesOrderId: order.id,
      customerId: customer.id,
      currency: order.currency,
      subtotal: new Prisma.Decimal(totals.subtotal.toFixed(3)),
      taxAmount: new Prisma.Decimal(totals.taxAmount.toFixed(3)),
      totalAmount: new Prisma.Decimal(totals.totalAmount.toFixed(3)),
      discountAmount,
      discountType: hasDiscount ? "FIXED" : null,
      discountRate: hasDiscount ? discountAmount : null,
      customerName: customer.name,
      customerAddress: customer.address,
      paymentTerms: order.notes ?? null,
      dueDate: null,
      notes: order.notes ?? null,
      warehouseName,
      deliveryStatus,
      lines: invoiceLines,
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
        totalAmount: totals.totalAmount.toNumber(),
      },
    });

    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "INVOICE_ISSUED",
      entityType: "SalesOrder",
      entityId: order.id,
      summary: `Invoice ${documentNumber} was issued for this order.`,
      metadata: {
        invoiceNumber: documentNumber,
        totalAmount: totals.totalAmount.toNumber(),
      },
    });

    return invoice;
  }
}
