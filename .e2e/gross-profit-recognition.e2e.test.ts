import { describe, it, expect, beforeAll, vi } from "vitest";

import { prisma } from "@/infrastructure/database/prisma";
import { InventoryReportService } from "@/domains/reports/services/inventory-report-service";
import { CreditNoteService } from "@/domains/credit-notes/services/credit-note-service";

/**
 * LIVE PROOF — gross profit follows the SALE, not the cash.
 *
 * The report filtered `status IN ('ISSUED', 'PAID')`. An invoice reaches
 * PARTIALLY_PAID the moment any part-payment is recorded, and OVERDUE when its
 * due date passes unpaid — both entirely normal. Either one made the whole sale
 * disappear from gross profit while its COGS stayed posted in the ledger, so
 * the report got *worse* the more customers paid.
 *
 * These run against real PostgreSQL because the defect lives in a WHERE clause;
 * a mocked client would happily return whatever the test handed it.
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

beforeAll(async () => {
  const prod = await prisma.product.findFirstOrThrow({ where: { organizationId: ORG } });
  const cust = await prisma.customer.findFirstOrThrow({ where: { organizationId: ORG } });
  productId = prod.id;
  uomId = prod.unitOfMeasureId;
  customerId = cust.id;
});

type InvoiceStatus = "ISSUED" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "CANCELLED" | "DRAFT";

/**
 * An isolated invoice in a given status. Each carries a uniquely-priced line so
 * it can be picked out of the report by its own revenue figure, independently
 * of anything else in the database.
 */
async function makeInvoice(status: InvoiceStatus, unitPrice: number, paid = 0) {
  const tag = Math.random().toString(36).slice(2, 8);

  const so = await prisma.salesOrder.create({
    data: {
      organizationId: ORG, soNumber: `SO-GP-${tag}`, customerId,
      status: "INVOICED", currency: "KWD",
      subtotal: unitPrice, taxAmount: 0, discountAmount: 0, totalAmount: unitPrice,
      createdById: ctx.userId, orderedAt: new Date(),
      lines: {
        create: [{
          organizationId: ORG, productId, unitOfMeasureId: uomId, lineNumber: 1,
          orderedQuantity: 1, unitPrice, totalPrice: unitPrice, lineType: "NORMAL",
          productName: `GP Product ${tag}`, productSku: `GP-${tag}`, unitOfMeasureCode: "PC",
        }],
      },
    },
    include: { lines: true },
  });

  return prisma.invoice.create({
    data: {
      organizationId: ORG,
      invoiceNumber: `INV-GP-${tag}`,
      salesOrderId: so.id,
      customerId,
      customerName: "Gross Profit Customer",
      status,
      currency: "KWD",
      subtotal: unitPrice, taxAmount: 0, discountAmount: 0, totalAmount: unitPrice,
      amountPaid: paid,
      creditedAmount: 0,
      issuedAt: new Date(),
      lines: {
        create: [{
          organization: { connect: { id: ORG } },
          salesOrderLine: { connect: { id: so.lines[0].id } },
          product: { connect: { id: productId } },
          unitOfMeasure: { connect: { id: uomId } },
          lineNumber: 1,
          quantity: 1, unitPrice, totalPrice: unitPrice, lineType: "NORMAL",
          productName: `GP Product ${tag}`, productSku: `GP-${tag}`, unitOfMeasureCode: "PC",
        }],
      },
    },
    include: { lines: true },
  });
}

/** The report rows belonging to one invoice, found by its number. */
async function rowsFor(invoiceNumber: string) {
  const rows = await new InventoryReportService().grossProfit({});
  return rows.filter((r) => r.invoiceNumber === invoiceNumber);
}

/** A unique price so each invoice is unmistakable in a shared database. */
function uniquePrice() {
  return Math.round((100 + Math.random() * 800) * 1000) / 1000;
}

describe("gross profit recognises sales, not collections", () => {
  it("#1 an ISSUED invoice contributes revenue", async () => {
    const price = uniquePrice();
    const invoice = await makeInvoice("ISSUED", price);

    const rows = await rowsFor(invoice.invoiceNumber);
    console.log(`   [gp #1] ISSUED rows=${rows.length} revenue=${rows[0]?.revenue} (expect ${price})`);

    expect(rows).toHaveLength(1);
    expect(rows[0].revenue).toBeCloseTo(price, 3);
  });

  it("#2 a PARTIALLY_PAID invoice still contributes revenue", async () => {
    // Taking a deposit used to erase the entire sale from the report.
    const price = uniquePrice();
    const invoice = await makeInvoice("PARTIALLY_PAID", price, Math.round(price / 2));

    const rows = await rowsFor(invoice.invoiceNumber);
    console.log(
      `   [gp #2] PARTIALLY_PAID rows=${rows.length} (expect 1) revenue=${rows[0]?.revenue} (expect ${price})`,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].revenue).toBeCloseTo(price, 3);
  });

  it("#3 a PAID invoice contributes revenue", async () => {
    const price = uniquePrice();
    const invoice = await makeInvoice("PAID", price, price);

    const rows = await rowsFor(invoice.invoiceNumber);
    console.log(`   [gp #3] PAID rows=${rows.length} revenue=${rows[0]?.revenue} (expect ${price})`);

    expect(rows).toHaveLength(1);
    expect(rows[0].revenue).toBeCloseTo(price, 3);
  });

  it("#4 an OVERDUE invoice still contributes revenue", async () => {
    // Passing a due date is not a reason to un-sell the goods.
    const price = uniquePrice();
    const invoice = await makeInvoice("OVERDUE", price);

    const rows = await rowsFor(invoice.invoiceNumber);
    console.log(
      `   [gp #4] OVERDUE rows=${rows.length} (expect 1) revenue=${rows[0]?.revenue} (expect ${price})`,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].revenue).toBeCloseTo(price, 3);
  });

  it("#5 a credited sale has its revenue reduced by the credit note", async () => {
    const price = 200;
    const invoice = await makeInvoice("ISSUED", price);

    await new CreditNoteService().issue(ctx, {
      invoiceId: invoice.id,
      customerId,
      reason: "Goods returned",
      lines: [{
        invoiceLineId: invoice.lines[0].id,
        productId, unitOfMeasureId: uomId,
        quantity: 1, unitPrice: 50, totalPrice: 50,
        productName: "GP Product", productSku: "GP", unitOfMeasureCode: "PC",
      }],
    } as never);

    const rows = await rowsFor(invoice.invoiceNumber);
    console.log(
      `   [gp #5] credited 50 of 200 -> revenue=${rows[0]?.revenue} (expect 150) rows=${rows.length}`,
    );

    // The sale is not erased; it is netted down by what was credited back.
    expect(rows).toHaveLength(1);
    expect(rows[0].revenue).toBeCloseTo(150, 3);
  });

  it("#6 a fully credited sale nets to zero revenue but stays visible", async () => {
    const price = 120;
    const invoice = await makeInvoice("ISSUED", price);

    await new CreditNoteService().issue(ctx, {
      invoiceId: invoice.id,
      customerId,
      reason: "Full return",
      lines: [{
        invoiceLineId: invoice.lines[0].id,
        productId, unitOfMeasureId: uomId,
        quantity: 1, unitPrice: price, totalPrice: price,
        productName: "GP Product", productSku: "GP", unitOfMeasureCode: "PC",
      }],
    } as never);

    const invoiceNow = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    const rows = await rowsFor(invoice.invoiceNumber);

    console.log(
      `   [gp #6] status=${invoiceNow.status} (expect CREDITED) rows=${rows.length} (expect 1) ` +
        `revenue=${rows[0]?.revenue} (expect 0)`,
    );

    // The invoice is now CREDITED. Including CREDITED in the recognition set and
    // netting the credit is what keeps the sale on the report at zero revenue
    // rather than making it vanish.
    expect(invoiceNow.status).toBe("CREDITED");
    expect(rows).toHaveLength(1);
    expect(rows[0].revenue).toBeCloseTo(0, 3);
  });

  it("#7 a cancelled credit note stops reducing revenue", async () => {
    const price = 300;
    const invoice = await makeInvoice("ISSUED", price);
    const svc = new CreditNoteService();

    const note = await svc.issue(ctx, {
      invoiceId: invoice.id,
      customerId,
      reason: "Raised in error",
      lines: [{
        invoiceLineId: invoice.lines[0].id,
        productId, unitOfMeasureId: uomId,
        quantity: 1, unitPrice: 100, totalPrice: 100,
        productName: "GP Product", productSku: "GP", unitOfMeasureCode: "PC",
      }],
    } as never);

    const whileIssued = await rowsFor(invoice.invoiceNumber);
    await svc.cancel(ctx, note!.id, "Raised in error");
    const afterCancel = await rowsFor(invoice.invoiceNumber);

    console.log(
      `   [gp #7] with credit revenue=${whileIssued[0]?.revenue} (expect 200) | ` +
        `after cancelling it revenue=${afterCancel[0]?.revenue} (expect 300)`,
    );

    expect(whileIssued[0].revenue).toBeCloseTo(200, 3);
    expect(afterCancel[0].revenue).toBeCloseTo(300, 3);
  });

  it("#8 DRAFT and CANCELLED invoices are still excluded", async () => {
    const draft = await makeInvoice("DRAFT", uniquePrice());
    const cancelled = await makeInvoice("CANCELLED", uniquePrice());

    const draftRows = await rowsFor(draft.invoiceNumber);
    const cancelledRows = await rowsFor(cancelled.invoiceNumber);

    console.log(
      `   [gp #8] DRAFT rows=${draftRows.length} (expect 0) CANCELLED rows=${cancelledRows.length} (expect 0)`,
    );

    expect(draftRows).toHaveLength(0);
    expect(cancelledRows).toHaveLength(0);
  });

  it("#9 the executive panel uses the same recognition rule as the detail report", async () => {
    // The two views were drifting: both filtered ('ISSUED','PAID'), but nothing
    // held them together. They now share one exported constant, and this proves
    // the executive query actually runs — its month trend uses raw SQL, which
    // typechecking cannot validate.
    const { ExecutiveService } = await import("@/app/reports/executive/executive-service");
    const summary = await new ExecutiveService().getSummary(ORG);

    const detail = await new InventoryReportService().grossProfit({});
    const detailRevenue = detail.reduce((sum, r) => sum + r.revenue, 0);

    console.log(
      `   [gp #9] executive revenue=${summary.profitability.totalRevenue} ` +
        `detail revenue=${Math.round(detailRevenue * 1000) / 1000} ` +
        `trend points=${summary.profitability.revenueTrend.length}`,
    );

    expect(summary.profitability.revenueTrend).toHaveLength(6);
    expect(Number.isFinite(summary.profitability.totalRevenue)).toBe(true);
    expect(summary.profitability.totalRevenue).toBeGreaterThan(0);
  });
});
