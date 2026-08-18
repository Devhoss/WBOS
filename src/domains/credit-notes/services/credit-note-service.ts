import { Prisma } from "@prisma/client";
import { prisma } from "@/infrastructure/database/prisma";
import { BusinessError } from "@/shared/errors/business-error";
import { DocumentNumberService } from "@/domains/documents/services/document-number-service";
import { CreditNoteRepository } from "../repositories/credit-note-repository";
import { ActivityLogRepository } from "@/domains/activity/repositories/activity-log-repository";
import { calculateDocumentTotals } from "@/shared/money/document-totals";
import type { IssueCreditNoteInput } from "../validation/credit-note-schema";

export class CreditNoteService {
  private repo = new CreditNoteRepository();
  private docs = new DocumentNumberService();
  private logs = new ActivityLogRepository();

  async issue(context: { organizationId: string; userId: string }, input: IssueCreditNoteInput) {
    const now = new Date();

    // The credit total is derived from the lines, never taken from the caller,
    // and the SAME figure is both applied to the invoice and stored on the
    // credit note -- so the two can never drift apart.
    const totals = calculateDocumentTotals({
      lines: input.lines.map((line) => ({
        quantity: line.quantity,
        unitPrice: line.unitPrice,
      })),
    });
    const creditTotal = new Prisma.Decimal(totals.totalAmount.toFixed(3));

    const invoice = await prisma.invoice.findFirst({
      where: { id: input.invoiceId, organizationId: context.organizationId },
      select: { id: true, invoiceNumber: true, totalAmount: true, creditedAmount: true },
    });

    if (!invoice) {
      throw new BusinessError("Invoice was not found.", "INVOICE_NOT_FOUND");
    }

    // Fast, friendly rejection for the ordinary case. This is NOT the
    // concurrency guard -- the conditional UPDATE below is.
    const remaining = new Prisma.Decimal(invoice.totalAmount).minus(invoice.creditedAmount);
    if (creditTotal.greaterThan(remaining)) {
      throw new BusinessError(
        `This credit note is for ${creditTotal.toFixed(3)} but only ${remaining.toFixed(3)} ` +
          `of invoice ${invoice.invoiceNumber} remains uncredited.`,
        "CREDIT_NOTE_EXCEEDS_INVOICE",
      );
    }

    const { documentNumber } = await this.docs.generate({
      organizationId: context.organizationId,
      documentType: "CN",
      year: now.getFullYear(),
      prefix: "CN",
    });

    const products = await prisma.product.findMany({
      where: { organizationId: context.organizationId, id: { in: input.lines.map((l) => l.productId) } },
      select: { id: true, arabicName: true },
    });
    const arabicNameMap = new Map(products.map((p) => [p.id, p.arabicName]));

    const creditNote = await prisma.$transaction(async (tx) => {
      // Claim the credit against the invoice FIRST, atomically. The ceiling
      // lives in the WHERE clause, so a concurrent issuance cannot squeeze past
      // it and no contribution can be lost to a stale read. Replaces a
      // re-aggregate-then-unconditional-write that had no ceiling at all.
      const applied = await tx.$executeRaw`
        UPDATE "invoices"
           SET "creditedAmount" = "creditedAmount" + ${creditTotal}
         WHERE "id" = ${input.invoiceId}
           AND "organizationId" = ${context.organizationId}
           AND "creditedAmount" + ${creditTotal} <= "totalAmount"
      `;

      if (Number(applied) !== 1) {
        const current = await tx.invoice.findFirst({
          where: { id: input.invoiceId, organizationId: context.organizationId },
          select: { totalAmount: true, creditedAmount: true },
        });
        const left = current
          ? new Prisma.Decimal(current.totalAmount).minus(current.creditedAmount).toFixed(3)
          : "0.000";
        throw new BusinessError(
          `This credit note is for ${creditTotal.toFixed(3)} but only ${left} of invoice ` +
            `${invoice.invoiceNumber} remains uncredited.`,
          "CREDIT_NOTE_EXCEEDS_INVOICE",
        );
      }

      // Created ISSUED in the same transaction: a credit note can never exist
      // without the matching invoice movement, and a refused claim leaves
      // nothing behind.
      const created = await this.repo.create(
        context.organizationId,
        documentNumber,
        context.userId,
        {
          ...input,
          totalAmount: creditTotal.toNumber(),
          status: "ISSUED",
          issuedAt: now,
          lines: input.lines.map((line, index) => ({
            ...line,
            unitPrice: totals.lines[index].unitPrice.toNumber(),
            totalPrice: totals.lines[index].totalPrice.toNumber(),
            productArabicName: arabicNameMap.get(line.productId) ?? null,
            lineNumber: index + 1,
          })),
        },
        tx,
      );

      // Status is derived from the post-increment authoritative figure, not
      // from the value this request happened to compute.
      const settled = await tx.invoice.findFirstOrThrow({
        where: { id: input.invoiceId, organizationId: context.organizationId },
        select: { creditedAmount: true, totalAmount: true },
      });

      if (new Prisma.Decimal(settled.creditedAmount).greaterThanOrEqualTo(settled.totalAmount)) {
        await tx.invoice.updateMany({
          where: { id: input.invoiceId, organizationId: context.organizationId },
          data: { status: "CREDITED" },
        });
      }

      return created;
    });

    await this.logs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "CREDIT_NOTE_ISSUED",
      entityType: "CreditNote",
      entityId: creditNote.id,
      summary: `Credit note ${documentNumber} was issued for invoice ${creditNote.invoice.invoiceNumber}.`,
      metadata: { creditNoteNumber: documentNumber, invoiceId: input.invoiceId },
    });

    await this.logs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "CREDIT_NOTE_ISSUED",
      entityType: "Invoice",
      entityId: input.invoiceId,
      summary: `Credit note ${documentNumber} was issued for this invoice.`,
      metadata: { creditNoteNumber: documentNumber },
    });

    const cnInvoice = await prisma.invoice.findFirst({
      where: { id: input.invoiceId, organizationId: context.organizationId },
      select: { salesOrder: { select: { id: true } } },
    });
    if (cnInvoice?.salesOrder?.id) {
      await this.logs.create({
        organizationId: context.organizationId,
        userId: context.userId,
        action: "CREDIT_NOTE_ISSUED",
        entityType: "SalesOrder",
        entityId: cnInvoice.salesOrder.id,
        summary: `Credit note ${documentNumber} was issued for invoice ${creditNote.invoice.invoiceNumber}.`,
        metadata: { creditNoteNumber: documentNumber },
      });
    }

    if (input.returnOrderId) {
      await this.logs.create({
        organizationId: context.organizationId,
        userId: context.userId,
        action: "CREDIT_NOTE_ISSUED",
        entityType: "ReturnOrder",
        entityId: input.returnOrderId,
        summary: `Credit note ${documentNumber} was issued for this return.`,
        metadata: { creditNoteNumber: documentNumber },
      });
    }

    return this.repo.findById(context.organizationId, creditNote.id);
  }

  async cancel(
    context: { organizationId: string; userId: string },
    id: string,
    reason?: string,
  ) {
    const creditNote = await this.repo.findById(context.organizationId, id);

    if (!creditNote) {
      throw new BusinessError("Credit note was not found.", "CREDIT_NOTE_NOT_FOUND");
    }

    if (creditNote.status !== "ISSUED") {
      throw new BusinessError("Only issued credit notes can be cancelled.", "CREDIT_NOTE_INVALID_STATUS");
    }

    const released = new Prisma.Decimal(creditNote.totalAmount);

    await prisma.$transaction(async (tx) => {
      // Claim the ISSUED -> CANCELLED transition conditionally, so two
      // concurrent cancellations cannot both release the same amount.
      const claimed = await tx.creditNote.updateMany({
        where: { id, organizationId: context.organizationId, status: "ISSUED" },
        data: { status: "CANCELLED", cancelledAt: new Date(), cancelledReason: reason },
      });

      if (claimed.count !== 1) {
        throw new BusinessError(
          "Only issued credit notes can be cancelled.",
          "CREDIT_NOTE_INVALID_STATUS",
        );
      }

      const applied = await tx.$executeRaw`
        UPDATE "invoices"
           SET "creditedAmount" = "creditedAmount" - ${released}
         WHERE "id" = ${creditNote.invoiceId}
           AND "organizationId" = ${context.organizationId}
           AND "creditedAmount" - ${released} >= 0
      `;

      if (Number(applied) !== 1) {
        throw new BusinessError(
          "Cancelling this credit note would drive the invoice credited amount below zero.",
          "CREDIT_NOTE_RELEASE_UNDERFLOW",
        );
      }
    });

    await this.logs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "CREDIT_NOTE_CANCELLED",
      entityType: "CreditNote",
      entityId: id,
      summary: `Credit note ${creditNote.creditNoteNumber} was cancelled.`,
      metadata: { creditNoteNumber: creditNote.creditNoteNumber, reason },
    });
  }

  async list(organizationId: string, pageSize = 50) {
    return this.repo.list(organizationId, pageSize);
  }

  async findById(organizationId: string, id: string) {
    return this.repo.findById(organizationId, id);
  }

  async issueFromReturn(
    context: { organizationId: string; userId: string },
    returnOrder: {
      id: string;
      returnNumber: string;
      customerId: string;
      invoice: { id: string } | null;
      lines: Array<{
        id: string;
        productId: string;
        unitOfMeasureId: string;
        invoiceLineId: string | null;
        receivedQuantity: number | Prisma.Decimal;
        unitPrice: number | Prisma.Decimal;
        disposition: string | null;
      }>;
    },
  ) {
    const invoice = returnOrder.invoice;
    if (!invoice) {
      throw new BusinessError(
        "Cannot issue credit note: Return is not linked to an invoice.",
        "RETURN_NO_INVOICE",
      );
    }

    const restockLines = returnOrder.lines
      .filter((l) => l.disposition === "RESTOCK" || l.disposition === "SCRAP");

    if (restockLines.length === 0) return null;

    const productIds = [...new Set(restockLines.map((l) => l.productId))];
    const uomIds = [...new Set(restockLines.map((l) => l.unitOfMeasureId))];

    const [invoiceLines, products, unitsOfMeasure] = await Promise.all([
      prisma.invoiceLine.findMany({
        where: { invoiceId: invoice.id, organizationId: context.organizationId },
        select: { id: true, productId: true, lineNumber: true },
        orderBy: { lineNumber: "asc" },
      }),
      prisma.product.findMany({
        where: { organizationId: context.organizationId, id: { in: productIds } },
        select: { id: true, name: true, arabicName: true, sku: true },
      }),
      prisma.unitOfMeasure.findMany({
        where: { id: { in: uomIds } },
        select: { id: true, code: true },
      }),
    ]);

    /**
     * First invoice line per product, in line order.
     *
     * Deliberately NOT a productId -> id map built by overwriting: the same
     * product legitimately appears twice (a NORMAL paid line and a FREE_SAMPLE
     * line), and a Map keeps the LAST entry, which silently attributed every
     * credit to the zero-priced free-sample line. This is only a fallback —
     * the return line's own invoiceLineId wins whenever it is known.
     */
    const firstInvoiceLineByProduct = new Map<string, string>();
    for (const il of invoiceLines) {
      if (!firstInvoiceLineByProduct.has(il.productId)) {
        firstInvoiceLineByProduct.set(il.productId, il.id);
      }
    }
    const invoiceLineIds = new Set(invoiceLines.map((il) => il.id));
    const productMap = new Map(products.map((p) => [p.id, p]));
    const uomMap = new Map(unitsOfMeasure.map((u) => [u.id, u]));

    const lines = restockLines.map((l) => {
      const product = productMap.get(l.productId);
      const uom = uomMap.get(l.unitOfMeasureId);
      // Prefer the exact source line; fall back to line order only when the
      // return does not record which invoice line it came from.
      const exact =
        l.invoiceLineId && invoiceLineIds.has(l.invoiceLineId) ? l.invoiceLineId : null;
      const resolvedInvoiceLineId = exact ?? firstInvoiceLineByProduct.get(l.productId) ?? null;
      return {
        invoiceLineId: resolvedInvoiceLineId ?? "",
        productId: l.productId,
        unitOfMeasureId: l.unitOfMeasureId,
        quantity: Number(l.receivedQuantity),
        unitPrice: Number(l.unitPrice),
        totalPrice: Number(l.unitPrice) * Number(l.receivedQuantity),
        productName: product?.name ?? "",
        productArabicName: product?.arabicName ?? null,
        productSku: product?.sku ?? "",
        unitOfMeasureCode: uom?.code ?? "",
      };
    });

    return this.issue(context, {
      invoiceId: invoice.id,
      returnOrderId: returnOrder.id,
      customerId: returnOrder.customerId,
      reason: `Credit from return ${returnOrder.returnNumber}`,
      lines,
    });
  }
}
