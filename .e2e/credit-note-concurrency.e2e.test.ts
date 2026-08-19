import { describe, it, expect, afterAll, beforeAll, vi } from "vitest";

import { prisma } from "@/infrastructure/database/prisma";
import { CreditNoteService } from "@/domains/credit-notes/services/credit-note-service";

/**
 * LIVE PROOFS — Invoice.creditedAmount must never exceed Invoice.totalAmount.
 *
 * `updateInvoiceCreditedAmount` re-aggregated every ISSUED credit note and then
 * wrote the result with an unconditional `invoice.update`. That is the same
 * read-then-unconditional-write shape as the original payment bug, on a field
 * with no CHECK constraint behind it:
 *
 *   - nothing capped the total credited at the invoice total, even
 *     single-threaded, so an invoice could be credited past what it was worth;
 *   - two concurrent issuances each aggregated a stale sum and each wrote it,
 *     so one credit's contribution was silently lost.
 *
 * These race against a real PostgreSQL with genuinely concurrent connections.
 * A mocked client cannot evaluate a SQL predicate, so the invariant has to be
 * proven here.
 */

vi.mock("@/infrastructure/request/authenticated-request-context", () => ({
  AuthenticatedRequestContextService: class {
    async getCurrentContext() {
      return { organizationId: "bootstrap-org-001", userId: "demo-system-user", role: "OWNER" };
    }
  },
}));

const ORG = "bootstrap-org-001";
const ctx = { organizationId: ORG, userId: "demo-system-user" };

let productId: string;
let uomId: string;
let customerId: string;

/**
 * Everything this suite creates, so it can take it all away again.
 *
 * There was no afterAll at all. Every run abandoned one sales order and one
 * ISSUED invoice, and ISSUED invoices are counted by the revenue and
 * gross-profit reports — so the suite was quietly inflating the figures of the
 * database it ran against, 28 invoices' worth by the time it was noticed. The
 * same defect as returns-duplicate-product-lines had.
 */
const created = { salesOrderIds: [] as string[], invoiceIds: [] as string[] };

beforeAll(async () => {
  const prod = await prisma.product.findFirstOrThrow({ where: { organizationId: ORG } });
  const cust = await prisma.customer.findFirstOrThrow({ where: { organizationId: ORG } });
  productId = prod.id;
  uomId = prod.unitOfMeasureId;
  customerId = cust.id;
});

afterAll(async () => {
  if (created.invoiceIds.length > 0) {
    const creditNotes = await prisma.creditNote.findMany({
      where: { invoiceId: { in: created.invoiceIds } },
      select: { id: true },
    });
    const creditNoteIds = creditNotes.map((c) => c.id);
    if (creditNoteIds.length > 0) {
      await prisma.creditNoteLine.deleteMany({ where: { creditNoteId: { in: creditNoteIds } } });
      await prisma.creditNote.deleteMany({ where: { id: { in: creditNoteIds } } });
    }
    await prisma.invoiceLine.deleteMany({ where: { invoiceId: { in: created.invoiceIds } } });
    await prisma.invoice.deleteMany({ where: { id: { in: created.invoiceIds } } });
  }
  if (created.salesOrderIds.length > 0) {
    await prisma.salesOrderLine.deleteMany({ where: { salesOrderId: { in: created.salesOrderIds } } });
    await prisma.salesOrder.deleteMany({ where: { id: { in: created.salesOrderIds } } });
  }
});

/** An isolated ISSUED invoice worth `total`, with one line, owned by nothing else. */
async function makeInvoice(total: number) {
  const tag = Math.random().toString(36).slice(2, 8);

  // An invoice requires a backing sales order, and each invoice line requires
  // the sales order line it came from.
  const so = await prisma.salesOrder.create({
    data: {
      organizationId: ORG, soNumber: `SO-CN-${tag}`, customerId,
      status: "INVOICED", currency: "KWD",
      subtotal: total, taxAmount: 0, discountAmount: 0, totalAmount: total,
      createdById: ctx.userId, orderedAt: new Date(),
      lines: {
        create: [{
          organizationId: ORG, productId, unitOfMeasureId: uomId, lineNumber: 1,
          orderedQuantity: 1, unitPrice: total, totalPrice: total, lineType: "NORMAL",
          productName: "Credit Race Product", productSku: `CNR-${tag}`, unitOfMeasureCode: "PC",
        }],
      },
    },
    include: { lines: true },
  });
  created.salesOrderIds.push(so.id);

  const invoice = await prisma.invoice.create({
    data: {
      organizationId: ORG,
      invoiceNumber: `INV-CN-${tag}`,
      salesOrderId: so.id,
      customerId,
      customerName: "Credit Race Customer",
      status: "ISSUED",
      currency: "KWD",
      subtotal: total,
      taxAmount: 0,
      discountAmount: 0,
      totalAmount: total,
      amountPaid: 0,
      creditedAmount: 0,
      issuedAt: new Date(),
      lines: {
        create: [
          {
            // Nested creates need the relation form, not the scalar.
            organization: { connect: { id: ORG } },
            salesOrderLine: { connect: { id: so.lines[0].id } },
            product: { connect: { id: productId } },
            unitOfMeasure: { connect: { id: uomId } },
            lineNumber: 1,
            quantity: 1,
            unitPrice: total,
            totalPrice: total,
            lineType: "NORMAL",
            productName: "Credit Race Product",
            productSku: `CNR-${tag}`,
            unitOfMeasureCode: "PC",
          },
        ],
      },
    },
    include: { lines: true },
  });
  created.invoiceIds.push(invoice.id);
  return invoice;
}

/** A credit note input worth exactly `amount` against one invoice line. */
function creditFor(
  invoiceId: string,
  invoiceLineId: string,
  amount: number,
) {
  return {
    invoiceId,
    customerId,
    reason: "Concurrency proof",
    lines: [
      {
        invoiceLineId,
        productId,
        unitOfMeasureId: uomId,
        quantity: 1,
        unitPrice: amount,
        totalPrice: amount,
        productName: "Credit Race Product",
        productSku: "CNR",
        unitOfMeasureCode: "PC",
      },
    ],
  } as never;
}

async function readInvoice(id: string) {
  const inv = await prisma.invoice.findUniqueOrThrow({ where: { id } });
  const issued = await prisma.creditNote.aggregate({
    where: { organizationId: ORG, invoiceId: id, status: "ISSUED" },
    _sum: { totalAmount: true },
  });
  return {
    credited: Number(inv.creditedAmount),
    total: Number(inv.totalAmount),
    status: inv.status,
    issuedSum: Number(issued._sum.totalAmount ?? 0),
  };
}

describe("credit notes cannot over-credit an invoice", () => {
  it("#1 two concurrent credits WITHIN the total both succeed and sum exactly", async () => {
    const invoice = await makeInvoice(100);
    const svc = new CreditNoteService();

    const results = await Promise.allSettled([
      svc.issue(ctx, creditFor(invoice.id, invoice.lines[0].id, 40)),
      svc.issue(ctx, creditFor(invoice.id, invoice.lines[0].id, 50)),
    ]);

    const ok = results.filter((r) => r.status === "fulfilled").length;
    const after = await readInvoice(invoice.id);

    console.log(
      `   [credit #1] succeeded=${ok}/2 creditedAmount=${after.credited} ` +
        `issuedSum=${after.issuedSum} total=${after.total}`,
    );

    // Neither contribution may be lost: 40 + 50 = 90.
    expect(ok).toBe(2);
    expect(after.credited).toBeCloseTo(90, 3);
    expect(after.credited).toBeCloseTo(after.issuedSum, 3);
  });

  it("#2 two concurrent credits EXCEEDING the total: only the valid amount lands", async () => {
    const invoice = await makeInvoice(100);
    const svc = new CreditNoteService();

    // 60 + 60 = 120 against a 100 invoice. At most one can win.
    const results = await Promise.allSettled([
      svc.issue(ctx, creditFor(invoice.id, invoice.lines[0].id, 60)),
      svc.issue(ctx, creditFor(invoice.id, invoice.lines[0].id, 60)),
    ]);

    const ok = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected");
    const after = await readInvoice(invoice.id);

    console.log(
      `   [credit #2] succeeded=${ok.length}/2 failed=${failed.length}/2 ` +
        `creditedAmount=${after.credited} total=${after.total}`,
    );

    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect((failed[0] as PromiseRejectedResult).reason).toMatchObject({
      code: "CREDIT_NOTE_EXCEEDS_INVOICE",
    });

    expect(after.credited).toBeCloseTo(60, 3);
    expect(after.credited).toBeLessThanOrEqual(after.total);
  });

  it("#3 a single credit cannot exceed the remaining invoice amount", async () => {
    const invoice = await makeInvoice(100);
    const svc = new CreditNoteService();

    await svc.issue(ctx, creditFor(invoice.id, invoice.lines[0].id, 70));

    // Only 30 remains; 40 must be refused.
    await expect(
      svc.issue(ctx, creditFor(invoice.id, invoice.lines[0].id, 40)),
    ).rejects.toMatchObject({ code: "CREDIT_NOTE_EXCEEDS_INVOICE" });

    const after = await readInvoice(invoice.id);
    console.log(`   [credit #3] creditedAmount=${after.credited} (expect 70) total=${after.total}`);

    expect(after.credited).toBeCloseTo(70, 3);
  });

  it("#4 a wider fan-out can never push creditedAmount past the total", async () => {
    // 10 concurrent credits of 30 against a 100 invoice: at most 3 fit.
    const invoice = await makeInvoice(100);
    const svc = new CreditNoteService();

    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () =>
        svc.issue(ctx, creditFor(invoice.id, invoice.lines[0].id, 30)),
      ),
    );

    const ok = results.filter((r) => r.status === "fulfilled").length;
    const after = await readInvoice(invoice.id);

    console.log(
      `   [credit #4] succeeded=${ok}/10 creditedAmount=${after.credited} ` +
        `issuedSum=${after.issuedSum} total=${after.total} status=${after.status}`,
    );

    expect(ok).toBe(3);
    expect(after.credited).toBeCloseTo(90, 3);
    expect(after.credited).toBeLessThanOrEqual(after.total);
    // The stored invoice figure and the credit notes themselves must agree.
    expect(after.credited).toBeCloseTo(after.issuedSum, 3);
  });

  it("#5 a refused credit leaves no credit note behind and no partial state", async () => {
    const invoice = await makeInvoice(100);
    const svc = new CreditNoteService();

    await expect(
      svc.issue(ctx, creditFor(invoice.id, invoice.lines[0].id, 150)),
    ).rejects.toMatchObject({ code: "CREDIT_NOTE_EXCEEDS_INVOICE" });

    const notes = await prisma.creditNote.count({
      where: { organizationId: ORG, invoiceId: invoice.id },
    });
    const lines = await prisma.creditNoteLine.count({
      where: { organizationId: ORG, creditNote: { invoiceId: invoice.id } },
    });
    const after = await readInvoice(invoice.id);

    console.log(
      `   [credit #5] creditNotes=${notes} (expect 0) lines=${lines} (expect 0) ` +
        `creditedAmount=${after.credited} (expect 0) status=${after.status} (expect ISSUED)`,
    );

    expect(notes).toBe(0);
    expect(lines).toBe(0);
    expect(after.credited).toBe(0);
    expect(after.status).toBe("ISSUED");
  });

  it("derives CREDITED status from the final authoritative credited amount", async () => {
    const invoice = await makeInvoice(100);
    const svc = new CreditNoteService();

    await svc.issue(ctx, creditFor(invoice.id, invoice.lines[0].id, 100));

    const after = await readInvoice(invoice.id);
    console.log(`   [credit status] credited=${after.credited} status=${after.status}`);

    expect(after.credited).toBeCloseTo(100, 3);
    expect(after.status).toBe("CREDITED");
  });

  it("the database itself refuses an over-credit, whatever the code does", async () => {
    // The application guard is the friendly path; this is the backstop that
    // binds any future code path written without knowledge of the rule.
    const invoice = await makeInvoice(100);

    await expect(
      prisma.$executeRaw`UPDATE "invoices" SET "creditedAmount" = 150 WHERE "id" = ${invoice.id}`,
    ).rejects.toThrow();

    const after = await readInvoice(invoice.id);
    expect(after.credited).toBe(0);
  });
});
