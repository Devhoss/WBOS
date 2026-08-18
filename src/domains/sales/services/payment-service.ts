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

    const amount = new Prisma.Decimal(input.amount);

    // Everything below is one transaction so a Payment row can never exist
    // without the matching balance change, and the balance itself moves via a
    // conditional relative update rather than an absolute value derived from
    // the SELECT above. The read is now only for validation messaging and
    // status decisions; the database is the authority on the balance.
    const payment = await prisma.$transaction(async (tx) => {
      const applied = await tx.$executeRaw`
        UPDATE "invoices"
           SET "amountPaid" = "amountPaid" + ${amount}
         WHERE "id" = ${invoice.id}
           AND "organizationId" = ${context.organizationId}
           AND "status" NOT IN ('PAID', 'CANCELLED', 'CREDITED')
           AND "amountPaid" + ${amount} <= "totalAmount"
      `;

      if (Number(applied) !== 1) {
        // Either another payment landed first and this one would now overpay,
        // or the invoice stopped being payable between the read and the write.
        const fresh = await tx.invoice.findFirst({
          where: { id: invoice.id, organizationId: context.organizationId },
          select: { amountPaid: true, totalAmount: true, status: true },
        });
        const outstanding = fresh
          ? Number(fresh.totalAmount) - Number(fresh.amountPaid)
          : 0;
        throw new BusinessError(
          `Payment of ${Number(input.amount).toFixed(3)} would exceed the outstanding balance of ${outstanding.toFixed(3)}.`,
          "INVOICE_OVERPAYMENT",
        );
      }

      const created = await tx.payment.create({
        data: {
          organizationId: context.organizationId,
          paymentNumber: documentNumber,
          invoiceId: invoice.id,
          customerId: invoice.customerId,
          amount,
          currency: input.currency,
          method: input.method,
          reference: input.reference,
          paidAt: input.paidAt ?? now,
          notes: input.notes,
        },
      });

      // Re-read inside the transaction so the status reflects the true total
      // after this increment, not the stale pre-read value.
      const settled = await tx.invoice.findFirstOrThrow({
        where: { id: invoice.id, organizationId: context.organizationId },
        select: { amountPaid: true, totalAmount: true },
      });
      const fullyPaid = Number(settled.amountPaid) >= Number(settled.totalAmount);

      await tx.invoice.updateMany({
        where: { id: invoice.id, organizationId: context.organizationId },
        data: fullyPaid ? { status: "PAID", paidAt: now } : { status: "PARTIALLY_PAID" },
      });

      if (fullyPaid) {
        await tx.salesOrder.updateMany({
          where: { id: invoice.salesOrderId, organizationId: context.organizationId },
          data: { status: "PAID" },
        });
      }

      return created;
    });

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

    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "PAYMENT_RECORDED",
      entityType: "Invoice",
      entityId: invoice.id,
      summary: `Payment ${documentNumber} of ${input.amount} ${input.currency} recorded.`,
      metadata: {
        paymentNumber: documentNumber,
        amount: input.amount,
        method: input.method,
      },
    });

    if (invoice.salesOrderId) {
      await this.activityLogs.create({
        organizationId: context.organizationId,
        userId: context.userId,
        action: "PAYMENT_RECORDED",
        entityType: "SalesOrder",
        entityId: invoice.salesOrderId,
        summary: `Payment ${documentNumber} of ${input.amount} ${input.currency} recorded for invoice ${invoice.invoiceNumber}.`,
        metadata: {
          paymentNumber: documentNumber,
          invoiceNumber: invoice.invoiceNumber,
          amount: input.amount,
          method: input.method,
        },
      });
    }

    return payment;
  }
}
