import { describe, it, expect, afterAll, beforeAll, vi } from "vitest";

import { prisma } from "@/infrastructure/database/prisma";
import { createFixtureTracker } from "./fixtures";
import { CreditNoteService } from "@/domains/credit-notes/services/credit-note-service";

/**
 * LIVE PROOF — cancelling a credit note releases the invoice's status, not just
 * its credited amount.
 *
 * `cancel()` decremented `creditedAmount` correctly but left `status` alone.
 * A fully credited invoice therefore stayed `CREDITED` after the credit note
 * was cancelled: a live, collectable invoice permanently marked as written off.
 * It also vanished from receivables, because every AR query filters on
 * `status IN ('ISSUED', 'PARTIALLY_PAID', 'OVERDUE')`.
 *
 * `CREDITED` now means "currently fully credited", and is re-derived from the
 * post-decrement figures inside the same transaction that releases them.
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
 * This suite had no teardown at all. Every run abandoned one sales order and
 * one ISSUED invoice, which the revenue and gross-profit reports then counted.
 */
const fixtures = createFixtureTracker();

afterAll(async () => {
  await fixtures.cleanup();
});

beforeAll(async () => {
  const prod = await prisma.product.findFirstOrThrow({ where: { organizationId: ORG } });
  const cust = await prisma.customer.findFirstOrThrow({ where: { organizationId: ORG } });
  productId = prod.id;
  uomId = prod.unitOfMeasureId;
  customerId = cust.id;
});

/** An isolated invoice worth `total` with `paid` already collected against it. */
async function makeInvoice(total: number, paid = 0) {
  const tag = Math.random().toString(36).slice(2, 8);

  const so = await prisma.salesOrder.create({
    data: {
      organizationId: ORG, soNumber: `SO-CNS-${tag}`, customerId,
      status: "INVOICED", currency: "KWD",
      subtotal: total, taxAmount: 0, discountAmount: 0, totalAmount: total,
      createdById: ctx.userId, orderedAt: new Date(),
      lines: {
        create: [{
          organizationId: ORG, productId, unitOfMeasureId: uomId, lineNumber: 1,
          orderedQuantity: 1, unitPrice: total, totalPrice: total, lineType: "NORMAL",
          productName: "Credit Status Product", productSku: `CNS-${tag}`, unitOfMeasureCode: "PC",
        }],
      },
    },
    include: { lines: true },
  });
  fixtures.salesOrder(so.id);

  // Seed amountPaid directly: this file is about the CREDIT path, and going
  // through PaymentService would drag its own status writes into the fixture.
  const status = paid <= 0 ? "ISSUED" : paid >= total ? "PAID" : "PARTIALLY_PAID";

  return prisma.invoice.create({
    data: {
      organizationId: ORG,
      invoiceNumber: `INV-CNS-${tag}`,
      salesOrderId: so.id,
      customerId,
      customerName: "Credit Status Customer",
      status,
      currency: "KWD",
      subtotal: total, taxAmount: 0, discountAmount: 0, totalAmount: total,
      amountPaid: paid,
      creditedAmount: 0,
      issuedAt: new Date(),
      ...(paid >= total ? { paidAt: new Date() } : {}),
      lines: {
        create: [{
          organization: { connect: { id: ORG } },
          salesOrderLine: { connect: { id: so.lines[0].id } },
          product: { connect: { id: productId } },
          unitOfMeasure: { connect: { id: uomId } },
          lineNumber: 1,
          quantity: 1, unitPrice: total, totalPrice: total, lineType: "NORMAL",
          productName: "Credit Status Product", productSku: `CNS-${tag}`, unitOfMeasureCode: "PC",
        }],
      },
    },
    include: { lines: true },
  });
}

function creditFor(invoiceId: string, invoiceLineId: string, amount: number) {
  return {
    invoiceId,
    customerId,
    reason: "Status derivation proof",
    lines: [{
      invoiceLineId, productId, unitOfMeasureId: uomId,
      quantity: 1, unitPrice: amount, totalPrice: amount,
      productName: "Credit Status Product", productSku: "CNS", unitOfMeasureCode: "PC",
    }],
  } as never;
}

async function readInvoice(id: string) {
  const inv = await prisma.invoice.findUniqueOrThrow({ where: { id } });
  return {
    status: inv.status,
    credited: Number(inv.creditedAmount),
    paid: Number(inv.amountPaid),
    total: Number(inv.totalAmount),
  };
}

describe("credit note cancellation restores the invoice's current state", () => {
  it("#1 fully paid, fully credited, credit cancelled -> PAID", async () => {
    const invoice = await makeInvoice(100, 100);
    const svc = new CreditNoteService();

    const note = await svc.issue(ctx, creditFor(invoice.id, invoice.lines[0].id, 100));
    const credited = await readInvoice(invoice.id);
    expect(credited.status).toBe("CREDITED");

    await svc.cancel(ctx, note!.id, "Issued in error");
    const after = await readInvoice(invoice.id);

    console.log(
      `   [status #1] after credit=${credited.status} | after cancel status=${after.status} ` +
        `(expect PAID) credited=${after.credited} (expect 0)`,
    );

    expect(after.status).toBe("PAID");
    expect(after.credited).toBeCloseTo(0, 3);
  });

  it("#2 partially paid, fully credited, credit cancelled -> PARTIALLY_PAID", async () => {
    const invoice = await makeInvoice(100, 40);
    const svc = new CreditNoteService();

    const note = await svc.issue(ctx, creditFor(invoice.id, invoice.lines[0].id, 100));
    expect((await readInvoice(invoice.id)).status).toBe("CREDITED");

    await svc.cancel(ctx, note!.id);
    const after = await readInvoice(invoice.id);

    console.log(
      `   [status #2] status=${after.status} (expect PARTIALLY_PAID) ` +
        `paid=${after.paid} credited=${after.credited}`,
    );

    expect(after.status).toBe("PARTIALLY_PAID");
    expect(after.credited).toBeCloseTo(0, 3);
  });

  it("#3 unpaid, fully credited, credit cancelled -> ISSUED", async () => {
    const invoice = await makeInvoice(100, 0);
    const svc = new CreditNoteService();

    const note = await svc.issue(ctx, creditFor(invoice.id, invoice.lines[0].id, 100));
    expect((await readInvoice(invoice.id)).status).toBe("CREDITED");

    await svc.cancel(ctx, note!.id);
    const after = await readInvoice(invoice.id);

    console.log(
      `   [status #3] status=${after.status} (expect ISSUED) credited=${after.credited} (expect 0)`,
    );

    expect(after.status).toBe("ISSUED");
    expect(after.credited).toBeCloseTo(0, 3);
  });

  it("#4 multiple credit notes: the invoice tracks the running total, not any single note", async () => {
    const invoice = await makeInvoice(100, 0);
    const svc = new CreditNoteService();

    const first = await svc.issue(ctx, creditFor(invoice.id, invoice.lines[0].id, 60));
    const afterFirst = await readInvoice(invoice.id);
    expect(afterFirst.status).toBe("ISSUED");
    expect(afterFirst.credited).toBeCloseTo(60, 3);

    const second = await svc.issue(ctx, creditFor(invoice.id, invoice.lines[0].id, 40));
    const afterSecond = await readInvoice(invoice.id);
    expect(afterSecond.status).toBe("CREDITED");
    expect(afterSecond.credited).toBeCloseTo(100, 3);

    // Cancelling ONE of two notes drops below the total, so CREDITED must lift.
    await svc.cancel(ctx, second!.id);
    const afterOneCancel = await readInvoice(invoice.id);

    // Cancelling the other releases the rest.
    await svc.cancel(ctx, first!.id);
    const afterBothCancelled = await readInvoice(invoice.id);

    console.log(
      `   [status #4] 60 -> ${afterFirst.status} | +40 -> ${afterSecond.status} | ` +
        `-40 -> ${afterOneCancel.status} credited=${afterOneCancel.credited} | ` +
        `-60 -> ${afterBothCancelled.status} credited=${afterBothCancelled.credited}`,
    );

    expect(afterOneCancel.status).toBe("ISSUED");
    expect(afterOneCancel.credited).toBeCloseTo(60, 3);
    expect(afterBothCancelled.status).toBe("ISSUED");
    expect(afterBothCancelled.credited).toBeCloseTo(0, 3);
  });

  it("#5 a partial credit never marks a live invoice CREDITED", async () => {
    const invoice = await makeInvoice(100, 0);
    const svc = new CreditNoteService();

    await svc.issue(ctx, creditFor(invoice.id, invoice.lines[0].id, 30));
    const after = await readInvoice(invoice.id);

    console.log(`   [status #5] credited=${after.credited} status=${after.status} (expect ISSUED)`);

    expect(after.status).toBe("ISSUED");
  });

  it("#6 a fully credited PAID invoice reads CREDITED, and re-reads PAID once released", async () => {
    // Fully credited wins over fully paid while the credit stands.
    const invoice = await makeInvoice(50, 50);
    const svc = new CreditNoteService();

    const note = await svc.issue(ctx, creditFor(invoice.id, invoice.lines[0].id, 50));
    expect((await readInvoice(invoice.id)).status).toBe("CREDITED");

    await svc.cancel(ctx, note!.id);
    const after = await readInvoice(invoice.id);

    console.log(`   [status #6] status=${after.status} (expect PAID) paid=${after.paid}`);
    expect(after.status).toBe("PAID");
  });

  it("#7 a released invoice is collectable again — it reappears in receivables", async () => {
    // The stuck CREDITED status was not cosmetic: every AR query filters on
    // status IN (ISSUED, PARTIALLY_PAID, OVERDUE), so the invoice disappeared
    // from receivables and from the customer's balance.
    const invoice = await makeInvoice(100, 0);
    const svc = new CreditNoteService();

    const note = await svc.issue(ctx, creditFor(invoice.id, invoice.lines[0].id, 100));

    const whileCredited = await prisma.invoice.count({
      where: { id: invoice.id, status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] } },
    });

    await svc.cancel(ctx, note!.id);

    const afterRelease = await prisma.invoice.count({
      where: { id: invoice.id, status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] } },
    });

    console.log(
      `   [status #7] in receivables while credited=${whileCredited} (expect 0) ` +
        `after release=${afterRelease} (expect 1)`,
    );

    expect(whileCredited).toBe(0);
    expect(afterRelease).toBe(1);
  });

  it("#7b concurrent cancellations converge on one correct status", async () => {
    // The status is re-derived from a row this transaction has already locked
    // with its conditional decrement, so two cancellations landing at once
    // cannot each decide the status from a stale read of the other's figures.
    const invoice = await makeInvoice(100, 100);
    const svc = new CreditNoteService();

    const a = await svc.issue(ctx, creditFor(invoice.id, invoice.lines[0].id, 60));
    const b = await svc.issue(ctx, creditFor(invoice.id, invoice.lines[0].id, 40));
    expect((await readInvoice(invoice.id)).status).toBe("CREDITED");

    const results = await Promise.allSettled([
      svc.cancel(ctx, a!.id),
      svc.cancel(ctx, b!.id),
    ]);

    const ok = results.filter((r) => r.status === "fulfilled").length;
    const after = await readInvoice(invoice.id);

    console.log(
      `   [status #7b] cancelled=${ok}/2 credited=${after.credited} (expect 0) ` +
        `status=${after.status} (expect PAID)`,
    );

    expect(ok).toBe(2);
    expect(after.credited).toBeCloseTo(0, 3);
    expect(after.status).toBe("PAID");
  });

  it("#8 a CANCELLED invoice is never given a payment status by the credit path", async () => {
    const invoice = await makeInvoice(100, 0);
    const svc = new CreditNoteService();

    const note = await svc.issue(ctx, creditFor(invoice.id, invoice.lines[0].id, 100));
    await prisma.invoice.update({ where: { id: invoice.id }, data: { status: "CANCELLED" } });

    await svc.cancel(ctx, note!.id);
    const after = await readInvoice(invoice.id);

    console.log(`   [status #8] status=${after.status} (expect CANCELLED) credited=${after.credited}`);

    expect(after.status).toBe("CANCELLED");
    // The money is still released even though the status is left alone.
    expect(after.credited).toBeCloseTo(0, 3);
  });
});
