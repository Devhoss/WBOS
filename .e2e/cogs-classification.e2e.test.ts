import { describe, it, expect, afterAll, beforeAll, vi } from "vitest";

import { prisma } from "@/infrastructure/database/prisma";
import { InventoryReportService } from "@/domains/reports/services/inventory-report-service";

/**
 * LIVE PROOF — what counts as cost of goods sold, and what does not.
 *
 * The COGS report listed EVERY costed outbound movement, and the executive
 * aggregate did the same with no movement-type filter whatsoever. So an
 * internal warehouse transfer, a cycle-count shrinkage and a damaged pallet
 * were all reported as cost of goods sold, and there was no way to see an
 * inventory loss as anything other than a bad margin.
 *
 * Customer returns were counted nowhere: the sale's cost stayed in COGS even
 * after the goods came back, so a returned sale read as pure loss.
 *
 * These run against real PostgreSQL because every defect lives in a WHERE
 * clause. A mocked client returns whatever the test hands it.
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

/**
 * Everything created here, so it can be removed again.
 *
 * These fixtures post real cost into the ledger, which is exactly what
 * `valuation-sync-e2e.test.ts` measures across the whole organization. Left
 * behind they shift its baseline and break the suite's re-runnability.
 */
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

  await prisma.creditNoteLine.deleteMany({ where });
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
      organizationId: ORG,
      sku: `CLASS-${tag}`,
      name: `Classification Product ${tag}`,
      unitOfMeasureId: uomId,
      categoryId: category?.id ?? null,
      status: "ACTIVE",
    },
  });
  const warehouse = await prisma.warehouse.create({
    data: { organizationId: ORG, code: `CLS-${tag}`.slice(0, 20), name: `Classification WH ${tag}` },
  });

  created.productIds.push(product.id);
  created.warehouseIds.push(warehouse.id);
  return { productId: product.id, warehouseId: warehouse.id, tag };
}

/** Posts one costed ledger entry of any movement type. */
async function postEntry(
  productId: string,
  warehouseId: string,
  movementType: string,
  direction: "IN" | "OUT",
  quantity: number,
  unitCost: number,
  reference?: { referenceType: string; referenceId: string },
) {
  const now = new Date();
  const totalCost = quantity * unitCost;

  const tx = await prisma.inventoryTransaction.create({
    data: {
      organizationId: ORG,
      type: movementType as never,
      occurredAt: now,
      createdById: USER,
      ...(reference ?? {}),
      lines: {
        create: [
          {
            organization: { connect: { id: ORG } },
            product: { connect: { id: productId } },
            unitOfMeasure: { connect: { id: uomId } },
            quantity,
            unitCost,
            totalCost,
          },
        ],
      },
    },
    include: { lines: true },
  });

  return prisma.inventoryLedgerEntry.create({
    data: {
      organizationId: ORG,
      transactionId: tx.id,
      transactionLineId: tx.lines[0].id,
      productId,
      warehouseId,
      movementType: movementType as never,
      direction,
      quantity,
      unitCost,
      totalCost,
      occurredAt: now,
    },
  });
}

/** Report rows for one product only, so a shared database cannot interfere. */
async function reportsFor(productSkuPrefix: string) {
  const svc = new InventoryReportService();
  const [cogs, writeOffs] = await Promise.all([svc.cogs({}), svc.writeOffs({})]);
  return {
    cogs: cogs.filter((r) => r.productSku.startsWith(productSkuPrefix)),
    writeOffs: writeOffs.filter((r) => r.productSku.startsWith(productSkuPrefix)),
  };
}

describe("COGS classification, live", () => {
  it("#1 a SALE is cost of goods sold", async () => {
    const { productId, warehouseId, tag } = await makePair("sale");
    await postEntry(productId, warehouseId, "SALE", "OUT", 100, 0.9);

    const { cogs, writeOffs } = await reportsFor(`CLASS-${tag}`);
    console.log(
      `   [class #1] SALE -> cogs rows=${cogs.length} impact=${cogs[0]?.costImpact} ` +
        `writeOff rows=${writeOffs.length} (expect 0)`,
    );

    expect(cogs).toHaveLength(1);
    expect(cogs[0].classification).toBe("Cost of Sales");
    expect(cogs[0].costImpact).toBeCloseTo(90, 3);
    expect(writeOffs).toHaveLength(0);
  });

  it("#2 a RESTOCK return takes cost back out of COGS", async () => {
    const { productId, warehouseId, tag } = await makePair("restock");
    await postEntry(productId, warehouseId, "SALE", "OUT", 100, 0.9);
    await postEntry(productId, warehouseId, "CUSTOMER_RETURN", "IN", 10, 0.9);

    const { cogs, writeOffs } = await reportsFor(`CLASS-${tag}`);
    const netCogs = cogs.reduce((s, r) => s + r.costImpact, 0);

    console.log(
      `   [class #2] SALE 90 + RESTOCK return 9 -> net COGS=${netCogs} (expect 81) ` +
        `writeOffs=${writeOffs.length} (expect 0)`,
    );

    expect(cogs).toHaveLength(2);
    expect(netCogs).toBeCloseTo(81, 3);
    // Restocked goods are back on the shelf. Nothing was lost.
    expect(writeOffs).toHaveLength(0);
  });

  it("#3 a SCRAP return reverses COGS and records a write-off", async () => {
    const { productId, warehouseId, tag } = await makePair("scrap");
    await postEntry(productId, warehouseId, "SALE", "OUT", 100, 0.9);
    // Both legs a scrap posts, at the original issue cost.
    await postEntry(productId, warehouseId, "CUSTOMER_RETURN", "IN", 10, 0.9);
    await postEntry(productId, warehouseId, "DAMAGE", "OUT", 10, 0.9);

    const { cogs, writeOffs } = await reportsFor(`CLASS-${tag}`);
    const netCogs = cogs.reduce((s, r) => s + r.costImpact, 0);
    const totalWriteOff = writeOffs.reduce((s, r) => s + r.totalCost, 0);

    console.log(
      `   [class #3] net COGS=${netCogs} (expect 81) writeOffs=${totalWriteOff} (expect 9) ` +
        `-- total cost still 90, now classified`,
    );

    expect(netCogs).toBeCloseTo(81, 3);
    expect(totalWriteOff).toBeCloseTo(9, 3);
    // The business still bore 90.000; the point is that 9.000 of it is a loss,
    // not a cost of sale.
    expect(netCogs + totalWriteOff).toBeCloseTo(90, 3);
  });

  it("#4 DAMAGE is a write-off, never COGS", async () => {
    const { productId, warehouseId, tag } = await makePair("damage");
    await postEntry(productId, warehouseId, "DAMAGE", "OUT", 5, 2);

    const { cogs, writeOffs } = await reportsFor(`CLASS-${tag}`);
    console.log(`   [class #4] DAMAGE -> cogs=${cogs.length} (expect 0) writeOffs=${writeOffs.length} (expect 1)`);

    expect(cogs).toHaveLength(0);
    expect(writeOffs).toHaveLength(1);
    expect(writeOffs[0].totalCost).toBeCloseTo(10, 3);
  });

  it("#5 EXPIRED is a write-off, never COGS", async () => {
    const { productId, warehouseId, tag } = await makePair("expired");
    await postEntry(productId, warehouseId, "EXPIRED", "OUT", 4, 1.5);

    const { cogs, writeOffs } = await reportsFor(`CLASS-${tag}`);
    console.log(`   [class #5] EXPIRED -> cogs=${cogs.length} (expect 0) writeOffs=${writeOffs.length} (expect 1)`);

    expect(cogs).toHaveLength(0);
    expect(writeOffs).toHaveLength(1);
    expect(writeOffs[0].totalCost).toBeCloseTo(6, 3);
  });

  it("#6 ADJUSTMENT_OUT (cycle-count shrinkage) is a write-off, never COGS", async () => {
    const { productId, warehouseId, tag } = await makePair("shrink");
    await postEntry(productId, warehouseId, "ADJUSTMENT_OUT", "OUT", 3, 2);

    const { cogs, writeOffs } = await reportsFor(`CLASS-${tag}`);
    console.log(
      `   [class #6] ADJUSTMENT_OUT -> cogs=${cogs.length} (expect 0) writeOffs=${writeOffs.length} (expect 1)`,
    );

    expect(cogs).toHaveLength(0);
    expect(writeOffs).toHaveLength(1);
    expect(writeOffs[0].totalCost).toBeCloseTo(6, 3);
  });

  it("#7 TRANSFER_OUT / TRANSFER_IN are neither COGS nor write-off", async () => {
    const { productId, warehouseId, tag } = await makePair("transfer");
    const other = await makePair("transfer-dest");
    await postEntry(productId, warehouseId, "TRANSFER_OUT", "OUT", 20, 3);
    await postEntry(productId, other.warehouseId, "TRANSFER_IN", "IN", 20, 3);

    const { cogs, writeOffs } = await reportsFor(`CLASS-${tag}`);
    console.log(
      `   [class #7] transfer pair -> cogs=${cogs.length} (expect 0) writeOffs=${writeOffs.length} (expect 0)`,
    );

    // TRANSFER_OUT used to be counted as cost of goods sold, so every internal
    // stock move inflated COGS by its full value.
    expect(cogs).toHaveLength(0);
    expect(writeOffs).toHaveLength(0);
  });

  it("#8 write-offs are reported separately from COGS, never mixed", async () => {
    const { productId, warehouseId, tag } = await makePair("mixed");
    await postEntry(productId, warehouseId, "SALE", "OUT", 50, 1);
    await postEntry(productId, warehouseId, "DAMAGE", "OUT", 5, 1);
    await postEntry(productId, warehouseId, "ADJUSTMENT_OUT", "OUT", 2, 1);
    await postEntry(productId, warehouseId, "TRANSFER_OUT", "OUT", 8, 1);

    const { cogs, writeOffs } = await reportsFor(`CLASS-${tag}`);
    const netCogs = cogs.reduce((s, r) => s + r.costImpact, 0);
    const totalWriteOff = writeOffs.reduce((s, r) => s + r.totalCost, 0);

    console.log(
      `   [class #8] COGS=${netCogs} (expect 50) writeOffs=${totalWriteOff} (expect 7) ` +
        `transfer excluded from both`,
    );

    expect(netCogs).toBeCloseTo(50, 3);
    expect(totalWriteOff).toBeCloseTo(7, 3);
    // Before: all four would have summed into COGS as 65.000.
    expect(netCogs).not.toBeCloseTo(65, 3);
  });

  it("#9 no ledger entry appears in both reports", async () => {
    const { productId, warehouseId, tag } = await makePair("disjoint");
    for (const [movement, direction] of [
      ["SALE", "OUT"],
      ["CUSTOMER_RETURN", "IN"],
      ["DAMAGE", "OUT"],
      ["EXPIRED", "OUT"],
      ["ADJUSTMENT_OUT", "OUT"],
      ["TRANSFER_OUT", "OUT"],
      ["TRANSFER_IN", "IN"],
      ["PURCHASE_RECEIPT", "IN"],
    ] as const) {
      await postEntry(productId, warehouseId, movement, direction, 1, 1);
    }

    const { cogs, writeOffs } = await reportsFor(`CLASS-${tag}`);
    const cogsMovements = cogs.map((r) => r.movementType).sort();
    const writeOffMovements = writeOffs.map((r) => r.movementType).sort();

    console.log(
      `   [class #9] COGS=${JSON.stringify(cogsMovements)} writeOffs=${JSON.stringify(writeOffMovements)}`,
    );

    expect(cogsMovements).toEqual(["CUSTOMER_RETURN", "SALE"]);
    expect(writeOffMovements).toEqual(["ADJUSTMENT_OUT", "DAMAGE", "EXPIRED"]);
    for (const m of cogsMovements) expect(writeOffMovements).not.toContain(m);
  });
});

/**
 * A complete sale: order -> line -> shipment -> SALE posting -> invoice.
 *
 * The gross-profit report matches an invoice line to its cost by walking
 * invoiceLine -> salesOrderLine -> shipmentLine -> SALE transaction line, so
 * the whole chain has to exist for the COGS figure to be real rather than zero.
 */
async function makeSoldInvoice(unitPrice: number, unitCost: number, quantity: number) {
  const { productId, warehouseId, tag } = await makePair("gp");
  const now = new Date();

  const so = await prisma.salesOrder.create({
    data: {
      organizationId: ORG, soNumber: `SO-GPC-${tag}`, customerId,
      status: "INVOICED", currency: "KWD",
      subtotal: unitPrice * quantity, taxAmount: 0, discountAmount: 0,
      totalAmount: unitPrice * quantity,
      createdById: USER, orderedAt: now,
      lines: {
        create: [{
          organizationId: ORG, productId, unitOfMeasureId: uomId, lineNumber: 1,
          orderedQuantity: quantity, unitPrice, totalPrice: unitPrice * quantity,
          lineType: "NORMAL", productName: `Classification Product ${tag}`,
          productSku: `CLASS-${tag}`, unitOfMeasureCode: "PC",
        }],
      },
    },
    include: { lines: true },
  });
  created.salesOrderIds.push(so.id);

  const shipment = await prisma.shipment.create({
    data: {
      organizationId: ORG, shipmentNumber: `SHP-GPC-${tag}`, salesOrderId: so.id,
      warehouseId, status: "DELIVERED", createdById: USER, deliveredAt: now,
      lines: {
        create: [{
          organization: { connect: { id: ORG } },
          salesOrderLine: { connect: { id: so.lines[0].id } },
          product: { connect: { id: productId } },
          unitOfMeasure: { connect: { id: uomId } },
          unitOfMeasureCode: "PC", quantity, pickedQuantity: quantity,
          productName: `Classification Product ${tag}`, productSku: `CLASS-${tag}`,
        }],
      },
    },
    include: { lines: true },
  });

  // The SALE posting the report reads COGS from, referenced by shipment.
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

  const invoice = await prisma.invoice.create({
    data: {
      organizationId: ORG, invoiceNumber: `INV-GPC-${tag}`, salesOrderId: so.id,
      customerId, customerName: "Classification Customer", status: "ISSUED", currency: "KWD",
      subtotal: unitPrice * quantity, taxAmount: 0, discountAmount: 0,
      totalAmount: unitPrice * quantity, amountPaid: 0, creditedAmount: 0, issuedAt: now,
      lines: {
        create: [{
          organization: { connect: { id: ORG } },
          salesOrderLine: { connect: { id: so.lines[0].id } },
          product: { connect: { id: productId } },
          unitOfMeasure: { connect: { id: uomId } },
          lineNumber: 1, quantity, unitPrice, totalPrice: unitPrice * quantity,
          lineType: "NORMAL", productName: `Classification Product ${tag}`,
          productSku: `CLASS-${tag}`, unitOfMeasureCode: "PC",
        }],
      },
    },
    include: { lines: true },
  });

  return { productId, warehouseId, tag, invoice, salesOrder: so };
}

/** A received return line against a known invoice line. */
async function makeReturnLine(
  invoiceId: string,
  salesOrderId: string,
  productId: string,
  invoiceLineId: string,
  quantity: number,
) {
  const tag = Math.random().toString(36).slice(2, 8);
  const ro = await prisma.returnOrder.create({
    data: {
      organizationId: ORG, returnNumber: `RET-GPC-${tag}`, salesOrderId, invoiceId,
      customerId, status: "RECEIVED", reason: "DEFECTIVE", createdById: USER,
      lines: {
        create: [{
          organization: { connect: { id: ORG } },
          product: { connect: { id: productId } },
          unitOfMeasure: { connect: { id: uomId } },
          invoiceLineId,
          lineNumber: 1, expectedQuantity: quantity, receivedQuantity: quantity, unitPrice: 0,
        }],
      },
    },
    include: { lines: true },
  });
  created.returnOrderIds.push(ro.id);
  return ro.lines[0];
}

async function grossProfitFor(invoiceNumber: string) {
  const rows = await new InventoryReportService().grossProfit({});
  return rows.filter((r) => r.invoiceNumber === invoiceNumber);
}

describe("gross profit after a return", () => {
  it("#10 a sellable (RESTOCK) return reverses the COGS on that invoice line", async () => {
    // 100 @ 1.500 sold, cost 0.900; 10 returned and restocked.
    const { productId, warehouseId, tag, invoice, salesOrder } = await makeSoldInvoice(1.5, 0.9, 100);

    const before = await grossProfitFor(invoice.invoiceNumber);
    expect(before[0].cogs).toBeCloseTo(90, 3);

    const returnLine = await makeReturnLine(
      invoice.id, salesOrder.id, productId, invoice.lines[0].id, 10,
    );
    await postEntry(productId, warehouseId, "CUSTOMER_RETURN", "IN", 10, 0.9, {
      referenceType: "ReturnOrderLine",
      referenceId: returnLine.id,
    });

    const after = await grossProfitFor(invoice.invoiceNumber);
    const { writeOffs } = await reportsFor(`CLASS-${tag}`);

    console.log(
      `   [class #10] cogs ${before[0].cogs} -> ${after[0].cogs} (expect 81) ` +
        `grossProfit=${after[0].grossProfit} (expect 69) writeOffs=${writeOffs.length} (expect 0)`,
    );

    expect(after[0].cogs).toBeCloseTo(81, 3);
    // Revenue is untouched: no credit note in this fixture, which isolates the
    // COGS reversal from the revenue reduction.
    expect(after[0].revenue).toBeCloseTo(150, 3);
    expect(after[0].grossProfit).toBeCloseTo(69, 3);
    // Restocked goods are back on the shelf. Nothing was lost.
    expect(writeOffs).toHaveLength(0);
  });

  it("#11 a SCRAP return reverses COGS and books the cost as a write-off", async () => {
    const { productId, warehouseId, tag, invoice, salesOrder } = await makeSoldInvoice(1.5, 0.9, 100);

    const returnLine = await makeReturnLine(
      invoice.id, salesOrder.id, productId, invoice.lines[0].id, 10,
    );
    // Both legs a scrap posts, at the original issue cost.
    await postEntry(productId, warehouseId, "CUSTOMER_RETURN", "IN", 10, 0.9, {
      referenceType: "ReturnOrderLine",
      referenceId: returnLine.id,
    });
    await postEntry(productId, warehouseId, "DAMAGE", "OUT", 10, 0.9, {
      referenceType: "ReturnOrderLine",
      referenceId: returnLine.id,
    });

    const after = await grossProfitFor(invoice.invoiceNumber);
    const { writeOffs } = await reportsFor(`CLASS-${tag}`);
    const totalWriteOff = writeOffs.reduce((s, r) => s + r.totalCost, 0);

    console.log(
      `   [class #11] cogs=${after[0].cogs} (expect 81) grossProfit=${after[0].grossProfit} (expect 69) ` +
        `writeOff=${totalWriteOff} (expect 9)`,
    );

    // Gross profit reads the same as the restock case -- the sale genuinely was
    // reversed either way. The difference is the 9.000 loss shown separately.
    expect(after[0].cogs).toBeCloseTo(81, 3);
    expect(after[0].grossProfit).toBeCloseTo(69, 3);
    expect(totalWriteOff).toBeCloseTo(9, 3);
  });

  it("#12 a return against a NORMAL line never credits the FREE_SAMPLE line", async () => {
    // The standing duplicate-product pattern. Postings reference the exact
    // ReturnOrderLine, and that line knows its invoice line, so a return
    // against the paid line cannot land on the zero-priced sample.
    const { productId, warehouseId, tag, invoice, salesOrder } = await makeSoldInvoice(1.5, 0.9, 100);

    // The free sample is its own order line, as it is in production — the two
    // lines carry the same productId but are distinct records throughout.
    const freeSoLine = await prisma.salesOrderLine.create({
      data: {
        organizationId: ORG, salesOrderId: salesOrder.id, productId,
        unitOfMeasureId: uomId, lineNumber: 2,
        orderedQuantity: 10, unitPrice: 0, totalPrice: 0, lineType: "FREE_SAMPLE",
        productName: `Classification Product ${tag}`, productSku: `CLASS-${tag}`,
        unitOfMeasureCode: "PC",
      },
    });

    const freeLine = await prisma.invoiceLine.create({
      data: {
        organization: { connect: { id: ORG } },
        invoice: { connect: { id: invoice.id } },
        salesOrderLine: { connect: { id: freeSoLine.id } },
        product: { connect: { id: productId } },
        unitOfMeasure: { connect: { id: uomId } },
        lineNumber: 2, quantity: 10, unitPrice: 0, totalPrice: 0,
        lineType: "FREE_SAMPLE", productName: `Classification Product ${tag}`,
        productSku: `CLASS-${tag}`, unitOfMeasureCode: "PC",
      },
    });

    const paidReturn = await makeReturnLine(
      invoice.id, salesOrder.id, productId, invoice.lines[0].id, 10,
    );
    await postEntry(productId, warehouseId, "CUSTOMER_RETURN", "IN", 10, 0.9, {
      referenceType: "ReturnOrderLine",
      referenceId: paidReturn.id,
    });

    const rows = await grossProfitFor(invoice.invoiceNumber);
    const paidRow = rows.find((r) => r.revenue > 0);
    const freeRow = rows.find((r) => r.revenue === 0);

    console.log(
      `   [class #12] rows=${rows.length} (expect 2) paid cogs=${paidRow?.cogs} (expect 81) ` +
        `free cogs=${freeRow?.cogs} (expect 0)`,
    );

    expect(rows).toHaveLength(2);
    // The reversal landed on the paid line...
    expect(paidRow!.cogs).toBeCloseTo(81, 3);
    // ...and not on the free-sample line, which has no cost of its own here.
    expect(freeRow!.cogs).toBeCloseTo(0, 3);
    expect(freeLine.lineType).toBe("FREE_SAMPLE");
  });

  it("#13 the COGS report, the detail report and the executive panel agree", async () => {
    // The three used to decide independently what counted as cost of sales.
    // They now share one classification module, and this proves the three
    // queries agree on live data rather than agreeing in principle.
    const { ExecutiveService } = await import("@/app/reports/executive/executive-service");
    const svc = new InventoryReportService();

    const [cogsRows, writeOffRows, summary] = await Promise.all([
      svc.cogs({}),
      svc.writeOffs({}),
      new ExecutiveService().getSummary(ORG),
    ]);

    const reportCogs = cogsRows.reduce((s, r) => s + r.costImpact, 0);
    const reportWriteOffs = writeOffRows.reduce((s, r) => s + r.totalCost, 0);

    console.log(
      `   [class #13] cogs report=${reportCogs.toFixed(3)} executive=${summary.profitability.totalCogs.toFixed(3)} | ` +
        `writeOffs report=${reportWriteOffs.toFixed(3)} executive=${summary.profitability.totalWriteOffs.toFixed(3)}`,
    );

    expect(summary.profitability.totalCogs).toBeCloseTo(reportCogs, 2);
    expect(summary.profitability.totalWriteOffs).toBeCloseTo(reportWriteOffs, 2);
    // And the two buckets are genuinely different numbers, so the assertions
    // above are not passing merely because both happen to be zero.
    expect(reportWriteOffs).toBeGreaterThan(0);
    expect(reportCogs).toBeGreaterThan(0);
  });
});
