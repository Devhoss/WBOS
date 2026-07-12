import { Prisma } from "@prisma/client";

import { ActivityLogRepository } from "@/domains/activity/repositories/activity-log-repository";
import { DocumentNumberService } from "@/domains/documents/services/document-number-service";
import { prisma } from "@/infrastructure/database/prisma";
import type { AuthenticatedRequestContext } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { InvoiceRepository } from "../repositories/invoice-repository";
import { PaymentRepository } from "../repositories/payment-repository";
import type { RecordPaymentInput } from "../validation/payment-schema";

export class PaymentService {
  constructor(
    private readonly payments = new PaymentRepository(),
    private readonly invoices = new InvoiceRepository(),
    private readonly documents = new DocumentNumberService(),
    private readonly activityLogs = new ActivityLogRepository(),
  ) {}

  async record(context: AuthenticatedRequestContext, input: RecordPaymentInput) {
    const invoice = await this.invoices.findById(context.organizationId, input.invoiceId);

    if (!invoice) {
      throw new BusinessError("Invoice was not found.", "INVOICE_NOT_FOUND");
    }

    if (invoice.status === "PAID" || invoice.status === "CANCELLED" || invoice.status === "CREDITED") {
      throw new BusinessError("This invoice cannot accept payments.", "INVOICE_NOT_PAYABLE");
    }

    const currentPaid = Number(invoice.amountPaid ?? 0);
    const totalAmount = Number(invoice.totalAmount);
    const newTotalPaid = currentPaid + Number(input.amount);

    if (newTotalPaid > totalAmount) {
      throw new BusinessError(
        `Payment of ${Number(input.amount).toFixed(3)} would exceed the outstanding balance of ${(totalAmount - currentPaid).toFixed(3)}.`,
        "INVOICE_OVERPAYMENT",
      );
    }

    const now = new Date();
    const { documentNumber } = await this.documents.generate({
      organizationId: context.organizationId,
      documentType: "PAY",
      year: now.getFullYear(),
      prefix: "PAY",
    });

    const payment = await this.payments.create(context.organizationId, documentNumber, {
      invoiceId: invoice.id,
      customerId: invoice.customerId,
      amount: input.amount,
      currency: input.currency,
      method: input.method,
      reference: input.reference,
      paidAt: input.paidAt ?? now,
      notes: input.notes,
    });

    const updatedAmountPaid = currentPaid + Number(input.amount);

    await prisma.invoice.updateMany({
      where: { id: invoice.id, organizationId: context.organizationId },
      data: { amountPaid: new Prisma.Decimal(updatedAmountPaid) },
    });

    if (updatedAmountPaid >= totalAmount) {
      await prisma.invoice.updateMany({
        where: { id: invoice.id, organizationId: context.organizationId },
        data: { status: "PAID", paidAt: now },
      });
      await prisma.salesOrder.updateMany({
        where: { id: invoice.salesOrderId, organizationId: context.organizationId },
        data: { status: "PAID" },
      });
    } else {
      await prisma.invoice.updateMany({
        where: { id: invoice.id, organizationId: context.organizationId },
        data: { status: "PARTIALLY_PAID" },
      });
    }

    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "PAYMENT_RECORDED",
      entityType: "Payment",
      entityId: payment.id,
      summary: `Payment ${documentNumber} of ${input.amount} ${input.currency} recorded for invoice ${invoice.invoiceNumber}.`,
      metadata: {
        paymentNumber: documentNumber,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        amount: input.amount,
        method: input.method,
      },
    });

    return payment;
  }
}
