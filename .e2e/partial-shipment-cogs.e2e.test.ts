import { describe, it, expect, afterAll, beforeAll, vi } from "vitest";

import { prisma } from "@/infrastructure/database/prisma";
import { InventoryReportService } from "@/domains/reports/services/inventory-report-service";

/**
 * LIVE PROOF — a sales-order line fulfilled across several shipments.
 *
 * The gross-profit report resolved an invoice line's cost through
 *
 *     new Map(shipmentLines.map((sl) => [sl.salesOrderLineId, sl]))
 *
 * A `Map` keeps the LAST entry for a repeated key, and a partially shipped
 * order line legitimately has one shipment line per despatch. So an order line
 * shipped in three consignments reported the cost of exactly one of them —
 * whichever sorted last by id — and the rest silently vanished from COGS.
 *
 * The direction of the error is the dangerous one: COGS is understated, so
 * gross profit is overstated. Nothing about the figures looks wrong; the report
 * simply claims the business made more money than it did.
 *
 * This is the same class of defect as the credit-note and returns bugs already
 * fixed in this codebase — identity collapsed into a Map on a key that is not
 * unique.
 */

vi.mock("@/infrastructure/request/authenticated-request-context", () => ({
  AuthenticatedRequestContextService: class {
    async getCurrentContext() {
      return { organizationId: "bootstrap-org-001", userId: "demo-system-user", role: "OWNER" };
    }
  },
}));

const ORG = "bootstrap-org-001";
const USER = "demo-system-user";

let uomId: string;
let customerId: string;

const created = {
  productIds: [] as string[],
  warehouseIds: [] as string[],
  salesOrderIds: [] as string[],
  returnOrderIds: [] as string[],
};

beforeAll(async () => {
  const prod = await prisma.product.findFirstOrThrow({ where: { organizationId: ORG } });
  const cust = await prisma.customer.findFirstOrThrow({ where: { organizationId: ORG } });
  uomId = prod.unitOfMeasureId;
  customerId = cust.id;
});

/** These fixtures post real cost, which `valuation-sync-e2e` measures org-wide. */
afterAll(async () => {
  if (created.productIds.length === 0) return;
  const where = { productId: { in: created.productIds } };

  const txIds = (
    await prisma.inventoryTransactionLine.findMany({ where, select: { transactionId: true } })
  ).map((l) => l.transactionId);

  await prisma.inventoryLedgerEntry.deleteMany({ where });
  await prisma.inventoryTransactionLine.deleteMany({ where });
  await prisma.inventoryTransaction.deleteMany({ where: { id: { in: txIds } } });
  await prisma.productCost.deleteMany({ where });
  await prisma.returnOrderLine.deleteMany({ where: { returnOrderId: { in: created.returnOrderIds } } });
  await prisma.returnOrder.deleteMany({ where: { id: { in: created.returnOrderIds } } });
  await prisma.shipmentLine.deleteMany({ where });
  await prisma.shipment.deleteMany({ where: { salesOrderId: { in: created.salesOrderIds } } });
  await prisma.invoiceLine.deleteMany({ where });
  await prisma.invoice.deleteMany({ where: { salesOrderId: { in: created.salesOrderIds } } });
  await prisma.salesOrderLine.deleteMany({ where: { salesOrderId: { in: created.salesOrderIds } } });
  await prisma.salesOrder.deleteMany({ where: { id: { in: created.salesOrderIds } } });
  await prisma.product.deleteMany({ where: { id: { in: created.productIds } } });
  await prisma.warehouse.deleteMany({ where: { id: { in: created.warehouseIds } } });
});

async function makePair(label: string) {
  const tag = `${label}-${Math.random().toString(36).slice(2, 8)}`;
  const category = await prisma.category.findFirst({ where: { organizationId: ORG } });

  const product = await prisma.product.create({
    data: {
      organizationId: ORG, sku: `PSHIP-${tag}`, name: `Partial Ship Product ${tag}`,
      unitOfMeasureId: uomId, categoryId: category?.id ?? null, status: "ACTIVE",
    },
  });
  const warehouse = await prisma.warehouse.create({
    data: { organizationId: ORG, code: `PS-${tag}`.slice(0, 20), name: `Partial Ship WH ${tag}` },
  });

  created.productIds.push(product.id);
  created.warehouseIds.push(warehouse.id);
  return { productId: product.id, warehouseId: warehouse.id, tag };
}

type LineSpec = { unitPrice: number; quantity: number; lineType?: "NORMAL" | "FREE_SAMPLE" };

/** A sales order plus its invoice, with one invoice line per order line. */
async function makeOrderAndInvoice(tag: string, productId: string, lines: LineSpec[]) {
  const now = new Date();
  const total = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);

  const so = await prisma.salesOrder.create({
    data: {
      organizationId: ORG, soNumber: `SO-PS-${tag}`, customerId,
      status: "INVOICED", currency: "KWD",
      subtotal: total, taxAmount: 0, discountAmount: 0, totalAmount: total,
      createdById: USER, orderedAt: now,
      lines: {
        create: lines.map((l, i) => ({
          organizationId: ORG, productId, unitOfMeasureId: uomId, lineNumber: i + 1,
          orderedQuantity: l.quantity, unitPrice: l.unitPrice,
          totalPrice: l.unitPrice * l.quantity, lineType: l.lineType ?? "NORMAL",
          productName: `Partial Ship Product ${tag}`, productSku: `PSHIP-${tag}`,
          unitOfMeasureCode: "PC",
        })),
      },
    },
    include: { lines: { orderBy: { lineNumber: "asc" } } },
  });
  created.salesOrderIds.push(so.id);

  const invoice = await prisma.invoice.create({
    data: {
      organizationId: ORG, invoiceNumber: `INV-PS-${tag}`, salesOrderId: so.id,
      customerId, customerName: "Partial Ship Customer", status: "ISSUED", currency: "KWD",
      subtotal: total, taxAmount: 0, discountAmount: 0, totalAmount: total,
      amountPaid: 0, creditedAmount: 0, issuedAt: now,
      lines: {
        create: lines.map((l, i) => ({
          organization: { connect: { id: ORG } },
          salesOrderLine: { connect: { id: so.lines[i].id } },
          product: { connect: { id: productId } },
          unitOfMeasure: { connect: { id: uomId } },
          lineNumber: i + 1, quantity: l.quantity, unitPrice: l.unitPrice,
          totalPrice: l.unitPrice * l.quantity, lineType: l.lineType ?? "NORMAL",
          productName: `Partial Ship Product ${tag}`, productSku: `PSHIP-${tag}`,
          unitOfMeasureCode: "PC",
        })),
      },
    },
    include: { lines: { orderBy: { lineNumber: "asc" } } },
  });

  return { so, invoice };
}

/**
 * One despatch: a shipment carrying `quantity` of a sales-order line, plus the
 * SALE posting that records what those units cost.
 */
async function despatch(
  tag: string,
  seq: number,
  productId: string,
  warehouseId: string,
  salesOrderId: string,
  salesOrderLineId: string,
  quantity: number,
  unitCost: number,
) {
  const now = new Date();

  const shipment = await prisma.shipment.create({
    data: {
      organizationId: ORG, shipmentNumber: `SHP-PS-${tag}-${seq}`, salesOrderId,
      warehouseId, status: "DELIVERED", createdById: USER, deliveredAt: now,
      lines: {
        create: [{
          organization: { connect: { id: ORG } },
          salesOrderLine: { connect: { id: salesOrderLineId } },
          product: { connect: { id: productId } },
          unitOfMeasure: { connect: { id: uomId } },
          unitOfMeasureCode: "PC", quantity, pickedQuantity: quantity,
          productName: `Partial Ship Product ${tag}`, productSku: `PSHIP-${tag}`,
        }],
      },
    },
    include: { lines: true },
  });

  const saleTx = await prisma.inventoryTransaction.create({
    data: {
      organizationId: ORG, type: "SALE", referenceType: "SHIPMENT", referenceId: shipment.id,
      occurredAt: now, createdById: USER,
      lines: {
        create: [{
          organization: { connect: { id: ORG } },
          product: { connect: { id: productId } },
          unitOfMeasure: { connect: { id: uomId } },
          quantity, unitCost, totalCost: unitCost * quantity,
        }],
      },
    },
    include: { lines: true },
  });

  await prisma.inventoryLedgerEntry.create({
    data: {
      organizationId: ORG, transactionId: saleTx.id, transactionLineId: saleTx.lines[0].id,
      productId, warehouseId, movementType: "SALE", direction: "OUT",
      quantity, unitCost, totalCost: unitCost * quantity, occurredAt: now,
    },
  });

  return { shipment, cost: unitCost * quantity };
}

async function rowsFor(invoiceNumber: string) {
  const rows = await new InventoryReportService().grossProfit({});
  return rows.filter((r) => r.invoiceNumber === invoiceNumber);
}

describe("COGS across a partially shipped sales-order line", () => {
  it("#1 two shipments of one order line: BOTH costs count", async () => {
    // 100 units at 2.000 = 200.000 revenue, despatched as 60 then 40.
    // Deliberately different unit costs so a dropped consignment is obvious:
    //   60 @ 1.000 =  60.000
    //   40 @ 3.000 = 120.000
    //                -------
    //                180.000
    const { productId, warehouseId, tag } = await makePair("two");
    const { so, invoice } = await makeOrderAndInvoice(tag, productId, [
      { unitPrice: 2, quantity: 100 },
    ]);

    const a = await despatch(tag, 1, productId, warehouseId, so.id, so.lines[0].id, 60, 1);
    const b = await despatch(tag, 2, productId, warehouseId, so.id, so.lines[0].id, 40, 3);

    const rows = await rowsFor(invoice.invoiceNumber);

    console.log(
      `   [pship #1] shipments cost ${a.cost} + ${b.cost} = ${a.cost + b.cost} | ` +
        `report cogs=${rows[0]?.cogs} (expect 180) grossProfit=${rows[0]?.grossProfit} (expect 20)`,
    );

    expect(rows).toHaveLength(1);
    // Before the fix this was 120.000 — the second shipment only — which
    // overstated gross profit by 60.000 on a 200.000 sale.
    expect(rows[0].cogs).toBeCloseTo(180, 3);
    expect(rows[0].revenue).toBeCloseTo(200, 3);
    expect(rows[0].grossProfit).toBeCloseTo(20, 3);
  });

  it("#2 three shipments: every consignment contributes", async () => {
    const { productId, warehouseId, tag } = await makePair("three");
    const { so, invoice } = await makeOrderAndInvoice(tag, productId, [
      { unitPrice: 5, quantity: 30 },
    ]);

    const costs = [
      (await despatch(tag, 1, productId, warehouseId, so.id, so.lines[0].id, 10, 1)).cost,
      (await despatch(tag, 2, productId, warehouseId, so.id, so.lines[0].id, 10, 2)).cost,
      (await despatch(tag, 3, productId, warehouseId, so.id, so.lines[0].id, 10, 4)).cost,
    ];
    const expected = costs.reduce((s, c) => s + c, 0); // 10 + 20 + 40 = 70

    const rows = await rowsFor(invoice.invoiceNumber);

    console.log(
      `   [pship #2] costs ${costs.join(" + ")} = ${expected} | report cogs=${rows[0]?.cogs}`,
    );

    expect(rows[0].cogs).toBeCloseTo(expected, 3);
    // The single worst outcome would be taking only the largest or last one.
    expect(rows[0].cogs).not.toBeCloseTo(40, 3);
  });

  it("#3 a single shipment is unchanged — no regression on the ordinary case", async () => {
    const { productId, warehouseId, tag } = await makePair("single");
    const { so, invoice } = await makeOrderAndInvoice(tag, productId, [
      { unitPrice: 1.5, quantity: 100 },
    ]);
    await despatch(tag, 1, productId, warehouseId, so.id, so.lines[0].id, 100, 0.9);

    const rows = await rowsFor(invoice.invoiceNumber);
    console.log(`   [pship #3] single shipment cogs=${rows[0]?.cogs} (expect 90)`);

    expect(rows[0].cogs).toBeCloseTo(90, 3);
    expect(rows[0].grossProfit).toBeCloseTo(60, 3);
  });

  it("#4 duplicate product: NORMAL and FREE_SAMPLE lines stay separate across shipments", async () => {
    // Both order lines carry the same productId — the standing WBOS pattern.
    // Each is shipped twice. The two lines must not pool their costs.
    const { productId, warehouseId, tag } = await makePair("dup");
    const { so, invoice } = await makeOrderAndInvoice(tag, productId, [
      { unitPrice: 2, quantity: 100, lineType: "NORMAL" },
      { unitPrice: 0, quantity: 20, lineType: "FREE_SAMPLE" },
    ]);

    // Paid line: 60 @ 1.000 + 40 @ 3.000 = 180.000
    await despatch(tag, 1, productId, warehouseId, so.id, so.lines[0].id, 60, 1);
    await despatch(tag, 2, productId, warehouseId, so.id, so.lines[0].id, 40, 3);
    // Free line: 10 @ 1.000 + 10 @ 2.000 = 30.000
    await despatch(tag, 3, productId, warehouseId, so.id, so.lines[1].id, 10, 1);
    await despatch(tag, 4, productId, warehouseId, so.id, so.lines[1].id, 10, 2);

    const rows = await rowsFor(invoice.invoiceNumber);
    const paid = rows.find((r) => r.revenue > 0);
    const free = rows.find((r) => r.revenue === 0);

    console.log(
      `   [pship #4] paid cogs=${paid?.cogs} (expect 180) free cogs=${free?.cogs} (expect 30) ` +
        `rows=${rows.length} (expect 2)`,
    );

    expect(rows).toHaveLength(2);
    expect(paid!.cogs).toBeCloseTo(180, 3);
    expect(free!.cogs).toBeCloseTo(30, 3);
    // Neither line may absorb the other's cost.
    expect(paid!.cogs).not.toBeCloseTo(210, 3);
    expect(free!.cogs).not.toBeCloseTo(210, 3);
  });

  it("#5 a return still credits the exact invoice line, on top of pooled shipment cost", async () => {
    // The aggregation fix must not disturb return crediting.
    const { productId, warehouseId, tag } = await makePair("ret");
    const { so, invoice } = await makeOrderAndInvoice(tag, productId, [
      { unitPrice: 2, quantity: 100 },
    ]);

    await despatch(tag, 1, productId, warehouseId, so.id, so.lines[0].id, 60, 1);
    await despatch(tag, 2, productId, warehouseId, so.id, so.lines[0].id, 40, 3);

    const ro = await prisma.returnOrder.create({
      data: {
        organizationId: ORG, returnNumber: `RET-PS-${tag}`, salesOrderId: so.id,
        invoiceId: invoice.id, customerId, status: "RECEIVED", reason: "DEFECTIVE",
        createdById: USER,
        lines: {
          create: [{
            organization: { connect: { id: ORG } },
            product: { connect: { id: productId } },
            unitOfMeasure: { connect: { id: uomId } },
            invoiceLineId: invoice.lines[0].id,
            lineNumber: 1, expectedQuantity: 10, receivedQuantity: 10, unitPrice: 0,
          }],
        },
      },
      include: { lines: true },
    });
    created.returnOrderIds.push(ro.id);

    const now = new Date();
    const returnTx = await prisma.inventoryTransaction.create({
      data: {
        organizationId: ORG, type: "CUSTOMER_RETURN",
        referenceType: "ReturnOrderLine", referenceId: ro.lines[0].id,
        occurredAt: now, createdById: USER,
        lines: {
          create: [{
            organization: { connect: { id: ORG } },
            product: { connect: { id: productId } },
            unitOfMeasure: { connect: { id: uomId } },
            quantity: 10, unitCost: 3, totalCost: 30,
          }],
        },
      },
      include: { lines: true },
    });
    await prisma.inventoryLedgerEntry.create({
      data: {
        organizationId: ORG, transactionId: returnTx.id,
        transactionLineId: returnTx.lines[0].id, productId, warehouseId,
        movementType: "CUSTOMER_RETURN", direction: "IN",
        quantity: 10, unitCost: 3, totalCost: 30, occurredAt: now,
      },
    });

    const rows = await rowsFor(invoice.invoiceNumber);

    console.log(
      `   [pship #5] pooled 180 less returned 30 -> cogs=${rows[0]?.cogs} (expect 150) ` +
        `grossProfit=${rows[0]?.grossProfit} (expect 50)`,
    );

    expect(rows[0].cogs).toBeCloseTo(150, 3);
    expect(rows[0].grossProfit).toBeCloseTo(50, 3);
  });

  it("#6 the detail report and the executive panel still agree", async () => {
    const { ExecutiveService } = await import("@/app/reports/executive/executive-service");
    const svc = new InventoryReportService();

    const [cogsRows, writeOffRows, summary] = await Promise.all([
      svc.cogs({}),
      svc.writeOffs({}),
      new ExecutiveService().getSummary(ORG),
    ]);

    const ledgerCogs = cogsRows.reduce((s, r) => s + r.costImpact, 0);
    const ledgerWriteOffs = writeOffRows.reduce((s, r) => s + r.totalCost, 0);

    console.log(
      `   [pship #6] ledger COGS report=${ledgerCogs.toFixed(3)} executive=${summary.profitability.totalCogs.toFixed(3)} | ` +
        `writeOffs report=${ledgerWriteOffs.toFixed(3)} executive=${summary.profitability.totalWriteOffs.toFixed(3)}`,
    );

    expect(summary.profitability.totalCogs).toBeCloseTo(ledgerCogs, 2);
    expect(summary.profitability.totalWriteOffs).toBeCloseTo(ledgerWriteOffs, 2);
  });

  it("#7 the detail report now accounts for every SALE cost it should", async () => {
    // The executive panel sums the ledger directly and was always right. The
    // detail report reconstructed cost per line and was dropping consignments,
    // so the two disagreed by exactly the lost shipments. This measures the
    // detail report against the ledger for one isolated order.
    const { productId, warehouseId, tag } = await makePair("recon");
    const { so, invoice } = await makeOrderAndInvoice(tag, productId, [
      { unitPrice: 4, quantity: 50 },
    ]);

    const a = await despatch(tag, 1, productId, warehouseId, so.id, so.lines[0].id, 20, 1.25);
    const b = await despatch(tag, 2, productId, warehouseId, so.id, so.lines[0].id, 20, 2.5);
    const c = await despatch(tag, 3, productId, warehouseId, so.id, so.lines[0].id, 10, 5);

    const ledgerTotal = await prisma.inventoryLedgerEntry.aggregate({
      where: { organizationId: ORG, productId, movementType: "SALE", direction: "OUT" },
      _sum: { totalCost: true },
    });

    const rows = await rowsFor(invoice.invoiceNumber);
    const reportTotal = rows.reduce((s, r) => s + r.cogs, 0);
    const expected = a.cost + b.cost + c.cost;

    console.log(
      `   [pship #7] ledger=${Number(ledgerTotal._sum.totalCost)} report=${reportTotal} expect=${expected}`,
    );

    expect(Number(ledgerTotal._sum.totalCost)).toBeCloseTo(expected, 3);
    expect(reportTotal).toBeCloseTo(expected, 3);
  });
});
