import { Prisma } from "@prisma/client";

import { ActivityLogRepository } from "@/domains/activity/repositories/activity-log-repository";
import { prisma } from "@/infrastructure/database/prisma";
import { DocumentNumberService } from "@/domains/documents/services/document-number-service";
import { SupplierRepository } from "@/domains/suppliers/repositories/supplier-repository";
import type { AuthenticatedRequestContext } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { SupplierInvoiceRepository } from "../repositories/supplier-invoice-repository";
import type {
  CreateSupplierInvoiceInput,
  RecordSupplierPaymentInput,
  UpdateSupplierInvoiceInput,
} from "../validation/supplier-invoice-schema";

export class SupplierInvoiceService {
  constructor(
    private readonly invoices = new SupplierInvoiceRepository(),
    private readonly suppliers = new SupplierRepository(),
    private readonly documents = new DocumentNumberService(),
    private readonly activityLogs = new ActivityLogRepository(),
  ) {}

  async create(context: AuthenticatedRequestContext, input: CreateSupplierInvoiceInput) {
    const supplier = await this.suppliers.findById(context.organizationId, input.supplierId);
    if (!supplier) {
      throw new BusinessError("Supplier was not found.", "SUPPLIER_INVOICE_SUPPLIER_NOT_FOUND");
    }

    const now = new Date();
    const { documentNumber } = await this.documents.generate({
      organizationId: context.organizationId,
      documentType: "SIV",
      year: now.getFullYear(),
      prefix: "SIV",
    });

    const invoice = await this.invoices.create(context.organizationId, documentNumber, context.userId, input);

    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "SUPPLIER_INVOICE_CREATED",
      entityType: "SupplierInvoice",
      entityId: invoice.id,
      summary: `Supplier invoice ${documentNumber} was created.`,
      metadata: {
        siNumber: documentNumber,
        supplierId: input.supplierId,
        totalAmount: input.totalAmount,
      },
    });

    return invoice;
  }

  async update(context: AuthenticatedRequestContext, input: UpdateSupplierInvoiceInput) {
    const invoice = await this.invoices.findById(context.organizationId, input.id);
    if (!invoice) {
      throw new BusinessError("Supplier invoice was not found.", "SUPPLIER_INVOICE_NOT_FOUND");
    }
    if (invoice.status !== "DRAFT") {
      throw new BusinessError("Only draft supplier invoices can be edited.", "SUPPLIER_INVOICE_NOT_DRAFT");
    }

    const updated = await this.invoices.update(context.organizationId, input.id, input);

    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "SUPPLIER_INVOICE_UPDATED",
      entityType: "SupplierInvoice",
      entityId: invoice.id,
      summary: `Supplier invoice ${invoice.siNumber} was updated.`,
      metadata: { siNumber: invoice.siNumber },
    });

    return updated;
  }

  async issue(context: AuthenticatedRequestContext, id: string) {
    const invoice = await this.invoices.findById(context.organizationId, id);
    if (!invoice) {
      throw new BusinessError("Supplier invoice was not found.", "SUPPLIER_INVOICE_NOT_FOUND");
    }
    if (invoice.status !== "DRAFT") {
      throw new BusinessError("Only draft supplier invoices can be issued.", "SUPPLIER_INVOICE_INVALID_STATUS");
    }

    const issuedAt = new Date();
    await this.invoices.markIssued(context.organizationId, id, issuedAt);

    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "SUPPLIER_INVOICE_ISSUED",
      entityType: "SupplierInvoice",
      entityId: invoice.id,
      summary: `Supplier invoice ${invoice.siNumber} was issued.`,
      metadata: { siNumber: invoice.siNumber },
    });
  }

  async recordPayment(context: AuthenticatedRequestContext, input: RecordSupplierPaymentInput) {
    const invoice = await this.invoices.findById(context.organizationId, input.supplierInvoiceId);
    if (!invoice) {
      throw new BusinessError("Supplier invoice was not found.", "SUPPLIER_INVOICE_NOT_FOUND");
    }
    if (invoice.status === "DRAFT") {
      throw new BusinessError("Issue the supplier invoice before recording a payment.", "SUPPLIER_INVOICE_NOT_ISSUED");
    }
    if (invoice.status === "CANCELLED") {
      throw new BusinessError("Cancelled supplier invoices cannot accept payments.", "SUPPLIER_INVOICE_CANCELLED");
    }

    const currentPaid = Number(invoice.amountPaid ?? 0);
    const totalAmount = Number(invoice.totalAmount);
    const newTotalPaid = currentPaid + Number(input.amount);
    if (newTotalPaid > totalAmount) {
      throw new BusinessError(
        `Payment of ${Number(input.amount).toFixed(3)} would exceed the outstanding balance of ${(totalAmount - currentPaid).toFixed(3)}.`,
        "SUPPLIER_INVOICE_OVERPAYMENT",
      );
    }

    const now = new Date();
    const { documentNumber } = await this.documents.generate({
      organizationId: context.organizationId,
      documentType: "SPAY",
      year: now.getFullYear(),
      prefix: "PAY",
    });

    const amount = new Prisma.Decimal(input.amount);

    // Same guarantee as customer payments: one transaction, and the balance
    // moves by a conditional relative update so two concurrent payments cannot
    // overwrite each other or push the invoice past its total.
    const payment = await prisma.$transaction(async (tx) => {
      const applied = await tx.$executeRaw`
        UPDATE "supplier_invoices"
           SET "amountPaid" = "amountPaid" + ${amount}
         WHERE "id" = ${invoice.id}
           AND "organizationId" = ${context.organizationId}
           AND "status" NOT IN ('DRAFT', 'CANCELLED', 'PAID')
           AND "amountPaid" + ${amount} <= "totalAmount"
      `;

      if (Number(applied) !== 1) {
        const fresh = await tx.supplierInvoice.findFirst({
          where: { id: invoice.id, organizationId: context.organizationId },
          select: { amountPaid: true, totalAmount: true },
        });
        const outstanding = fresh
          ? Number(fresh.totalAmount) - Number(fresh.amountPaid)
          : 0;
        throw new BusinessError(
          `Payment of ${Number(input.amount).toFixed(3)} would exceed the outstanding balance of ${outstanding.toFixed(3)}.`,
          "SUPPLIER_INVOICE_OVERPAYMENT",
        );
      }

      const created = await tx.supplierInvoicePayment.create({
        data: {
          organizationId: context.organizationId,
          paymentNumber: documentNumber,
          supplierInvoiceId: invoice.id,
          amount,
          currency: input.currency,
          method: input.method,
          reference: input.reference,
          paidAt: input.paidAt ?? now,
          notes: input.notes,
          createdById: context.userId,
        },
      });

      const settled = await tx.supplierInvoice.findFirstOrThrow({
        where: { id: invoice.id, organizationId: context.organizationId },
        select: { amountPaid: true, totalAmount: true },
      });

      await tx.supplierInvoice.updateMany({
        where: { id: invoice.id, organizationId: context.organizationId },
        data:
          Number(settled.amountPaid) >= Number(settled.totalAmount)
            ? { status: "PAID", paidAt: now }
            : { status: "PARTIALLY_PAID" },
      });

      return created;
    });

    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "SUPPLIER_INVOICE_PAYMENT_RECORDED",
      entityType: "SupplierInvoice",
      entityId: invoice.id,
      summary: `Payment ${documentNumber} of ${input.amount} ${input.currency} recorded for supplier invoice ${invoice.siNumber}.`,
      metadata: {
        paymentNumber: documentNumber,
        amount: input.amount,
        method: input.method,
        supplierInvoiceId: invoice.id,
      },
    });

    return payment;
  }

  async cancel(context: AuthenticatedRequestContext, id: string) {
    const invoice = await this.invoices.findById(context.organizationId, id);
    if (!invoice) {
      throw new BusinessError("Supplier invoice was not found.", "SUPPLIER_INVOICE_NOT_FOUND");
    }
    if (!["DRAFT", "ISSUED"].includes(invoice.status)) {
      throw new BusinessError("This supplier invoice cannot be cancelled.", "SUPPLIER_INVOICE_CANNOT_CANCEL");
    }
    if (invoice.payments.length > 0) {
      throw new BusinessError(
        "Cannot cancel a supplier invoice that has recorded payments.",
        "SUPPLIER_INVOICE_HAS_PAYMENTS",
      );
    }

    await this.invoices.updateStatus(context.organizationId, id, "CANCELLED");

    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "SUPPLIER_INVOICE_CANCELLED",
      entityType: "SupplierInvoice",
      entityId: invoice.id,
      summary: `Supplier invoice ${invoice.siNumber} was cancelled.`,
      metadata: { siNumber: invoice.siNumber },
    });
  }

  async archive(context: AuthenticatedRequestContext, id: string) {
    const invoice = await this.invoices.findById(context.organizationId, id);
    if (!invoice) {
      throw new BusinessError("Supplier invoice was not found.", "SUPPLIER_INVOICE_NOT_FOUND");
    }
    if (invoice.archivedAt) {
      throw new BusinessError("Supplier invoice is already archived.", "SUPPLIER_INVOICE_ALREADY_ARCHIVED");
    }

    await this.invoices.archive(context.organizationId, id);

    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "SUPPLIER_INVOICE_ARCHIVED",
      entityType: "SupplierInvoice",
      entityId: invoice.id,
      summary: `Supplier invoice ${invoice.siNumber} was archived.`,
      metadata: { siNumber: invoice.siNumber },
    });
  }
}