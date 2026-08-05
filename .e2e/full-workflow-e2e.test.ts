import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { Prisma } from "@prisma/client";

import { DashboardService } from "@/app/dashboard-service";
import { InventoryValuationService } from "@/domains/inventory/services/inventory-valuation-service";
import { InventoryReportService } from "@/domains/reports/services/inventory-report-service";
import { PurchaseOrderService } from "@/domains/purchasing/services/purchase-order-service";
import { GoodsReceiptService } from "@/domains/purchasing/services/goods-receipt-service";
import { LandedCostService } from "@/domains/purchasing/services/landed-cost-service";
import { SalesOrderService } from "@/domains/sales/services/sales-order-service";
import { ShipmentService } from "@/domains/sales/services/shipment-service";
import { PaymentService } from "@/domains/sales/services/payment-service";
import { ReturnOrderService } from "@/domains/returns/services/return-order-service";
import type { AuthenticatedRequestContext } from "@/infrastructure/request/authenticated-request-context";
import { prisma } from "@/infrastructure/database/prisma";

vi.mock("@/infrastructure/request/authenticated-request-context", () => ({
  AuthenticatedRequestContextService: class {
    async getCurrentContext() {
      return { organizationId: "bootstrap-org-001", userId: "demo-system-user", role: "OWNER" };
    }
  },
}));

const ORG = "bootstrap-org-001";
const WH_MAIN = "bootstrap-wh-01";
const UOM_PC = "bootstrap-uom-pc";
const CAT_BEV = "bootstrap-cat-01";
const SUPPLIER = "demo-sup-mulla";
const CUSTOMER = "demo-cus-salam";

const context = {
  organizationId: ORG,
  userId: "demo-system-user",
  user: { id: "demo-system-user", name: "System", email: "system@wbos.local" },
  organization: { id: ORG, name: "My Organization" },
  membership: { id: "mem-e2e", organizationId: ORG, userId: "demo-system-user", role: "OWNER" },
  role: "OWNER",
  session: { id: "sess-e2e" },
} as unknown as AuthenticatedRequestContext;

const dashboard = new DashboardService();
const valuation = new InventoryValuationService();
const report = new InventoryReportService();
const purchases = new PurchaseOrderService();
const receipts = new GoodsReceiptService();
const landedCosts = new LandedCostService();
const salesOrders = new SalesOrderService();
const shipments = new ShipmentService();
const payments = new PaymentService();
const returns = new ReturnOrderService();

type Snapshot = {
  productCost: Array<{ id: string; productId: string; warehouseId: string; averageCost: string; totalQuantity: string; totalValue: string }>;
  documents: Array<{ id: string; documentType: string; year: number; currentSequence: number }>;
  existing: {
    transactions: Set<string>;
    landedCosts: Set<string>;
    shipments: Set<string>;
    shipmentLines: Set<string>;
    activityLogs: Set<string>;
    purchaseOrders: Set<string>;
    purchaseOrderLines: Set<string>;
    salesOrders: Set<string>;
    salesOrderLines: Set<string>;
    invoices: Set<string>;
    invoiceLines: Set<string>;
    payments: Set<string>;
    returnOrders: Set<string>;
    returnOrderLines: Set<string>;
    creditNotes: Set<string>;
    creditNoteLines: Set<string>;
    products: Set<string>;
  };
};

async function snapshot(): Promise<Snapshot> {
  const [
    productCost, documents, transactions, landedCostRows, shipmentRows, shipmentLineRows, activityLogRows,
    purchaseOrderRows, purchaseOrderLineRows, salesOrderRows, salesOrderLineRows, invoiceRows, invoiceLineRows,
    paymentRows, returnOrderRows, returnOrderLineRows, creditNoteRows, creditNoteLineRows,
    productRows,
  ] = await Promise.all([
    prisma.productCost.findMany({ where: { organizationId: ORG }, select: { id: true, productId: true, warehouseId: true, averageCost: true, totalQuantity: true, totalValue: true } }),
    prisma.documentSequence.findMany({ where: { organizationId: ORG } }),
    prisma.inventoryTransaction.findMany({ where: { organizationId: ORG }, select: { id: true } }),
    prisma.landedCost.findMany({ where: { organizationId: ORG }, select: { id: true } }),
    prisma.shipment.findMany({ where: { organizationId: ORG }, select: { id: true } }),
    prisma.shipmentLine.findMany({ where: { organizationId: ORG }, select: { id: true } }),
    prisma.activityLog.findMany({ where: { organizationId: ORG }, select: { id: true } }),
    prisma.purchaseOrder.findMany({ where: { organizationId: ORG }, select: { id: true } }),
    prisma.purchaseOrderLine.findMany({ where: { organizationId: ORG }, select: { id: true } }),
    prisma.salesOrder.findMany({ where: { organizationId: ORG }, select: { id: true } }),
    prisma.salesOrderLine.findMany({ where: { organizationId: ORG }, select: { id: true } }),
    prisma.invoice.findMany({ where: { organizationId: ORG }, select: { id: true } }),
    prisma.invoiceLine.findMany({ where: { organizationId: ORG }, select: { id: true } }),
    prisma.payment.findMany({ where: { organizationId: ORG }, select: { id: true } }),
    prisma.returnOrder.findMany({ where: { organizationId: ORG }, select: { id: true } }),
    prisma.returnOrderLine.findMany({ where: { organizationId: ORG }, select: { id: true } }),
    prisma.creditNote.findMany({ where: { organizationId: ORG }, select: { id: true } }),
    prisma.creditNoteLine.findMany({ where: { organizationId: ORG }, select: { id: true } }),
    prisma.product.findMany({ where: { organizationId: ORG }, select: { id: true } }),
  ]);

  const toSet = (rows: Array<{ id: string }>) => new Set(rows.map((r) => r.id));

  return {
    productCost: productCost.map((c) => ({
      ...c,
      averageCost: c.averageCost.toString(),
      totalQuantity: c.totalQuantity.toString(),
      totalValue: c.totalValue.toString(),
    })),
    documents: documents.map((d) => ({ id: d.id, documentType: d.documentType, year: d.year, currentSequence: d.currentSequence })),
    existing: {
      transactions: toSet(transactions),
      landedCosts: toSet(landedCostRows),
      shipments: toSet(shipmentRows),
      shipmentLines: toSet(shipmentLineRows),
      activityLogs: toSet(activityLogRows),
      purchaseOrders: toSet(purchaseOrderRows),
      purchaseOrderLines: toSet(purchaseOrderLineRows),
      salesOrders: toSet(salesOrderRows),
      salesOrderLines: toSet(salesOrderLineRows),
      invoices: toSet(invoiceRows),
      invoiceLines: toSet(invoiceLineRows),
      payments: toSet(paymentRows),
      returnOrders: toSet(returnOrderRows),
      returnOrderLines: toSet(returnOrderLineRows),
      creditNotes: toSet(creditNoteRows),
      creditNoteLines: toSet(creditNoteLineRows),
      products: toSet(productRows),
    },
  };
}

async function restore(snap: Snapshot) {
  const collect = async (model: { findMany: (args: { where: { organizationId: string }; select: { id: true } }) => Promise<Array<{ id: string }>> }, existing: Set<string>) =>
    (await model.findMany({ where: { organizationId: ORG }, select: { id: true } }))
      .map((r) => r.id)
      .filter((id) => !existing.has(id));

  const createdCreditNoteLines = await collect(prisma.creditNoteLine, snap.existing.creditNoteLines);
  const createdCreditNotes = await collect(prisma.creditNote, snap.existing.creditNotes);
  const createdReturnOrderLines = await collect(prisma.returnOrderLine, snap.existing.returnOrderLines);
  const createdReturnOrders = await collect(prisma.returnOrder, snap.existing.returnOrders);
  const createdPayments = await collect(prisma.payment, snap.existing.payments);
  const createdInvoiceLines = await collect(prisma.invoiceLine, snap.existing.invoiceLines);
  const createdInvoices = await collect(prisma.invoice, snap.existing.invoices);
  const createdShipmentLines = await collect(prisma.shipmentLine, snap.existing.shipmentLines);
  const createdShipments = await collect(prisma.shipment, snap.existing.shipments);
  const createdSalesOrderLines = await collect(prisma.salesOrderLine, snap.existing.salesOrderLines);
  const createdSalesOrders = await collect(prisma.salesOrder, snap.existing.salesOrders);
  const createdPurchaseOrderLines = await collect(prisma.purchaseOrderLine, snap.existing.purchaseOrderLines);
  const createdPurchaseOrders = await collect(prisma.purchaseOrder, snap.existing.purchaseOrders);
  const createdLcs = await collect(prisma.landedCost, snap.existing.landedCosts);
  const createdTxns = await collect(prisma.inventoryTransaction, snap.existing.transactions);
  const createdLogs = await collect(prisma.activityLog, snap.existing.activityLogs);

  if (createdCreditNoteLines.length > 0) {
    await prisma.creditNoteLine.deleteMany({ where: { id: { in: createdCreditNoteLines } } });
  }
  if (createdCreditNotes.length > 0) {
    await prisma.creditNote.deleteMany({ where: { id: { in: createdCreditNotes } } });
  }
  if (createdReturnOrderLines.length > 0) {
    await prisma.returnOrderLine.deleteMany({ where: { id: { in: createdReturnOrderLines } } });
  }
  if (createdReturnOrders.length > 0) {
    await prisma.returnOrder.deleteMany({ where: { id: { in: createdReturnOrders } } });
  }
  if (createdPayments.length > 0) {
    await prisma.payment.deleteMany({ where: { id: { in: createdPayments } } });
  }
  if (createdInvoiceLines.length > 0) {
    await prisma.invoiceLine.deleteMany({ where: { id: { in: createdInvoiceLines } } });
  }
  if (createdInvoices.length > 0) {
    await prisma.invoice.deleteMany({ where: { id: { in: createdInvoices } } });
  }
  if (createdShipmentLines.length > 0) {
    await prisma.shipmentLine.deleteMany({ where: { id: { in: createdShipmentLines } } });
  }
  if (createdShipments.length > 0) {
    await prisma.shipment.deleteMany({ where: { id: { in: createdShipments } } });
  }
  if (createdSalesOrderLines.length > 0) {
    await prisma.salesOrderLine.deleteMany({ where: { id: { in: createdSalesOrderLines } } });
  }
  if (createdSalesOrders.length > 0) {
    await prisma.salesOrder.deleteMany({ where: { id: { in: createdSalesOrders } } });
  }

  for (const lcId of createdLcs) {
    await prisma.landedCostAllocation.deleteMany({ where: { landedCostId: lcId } });
    await prisma.landedCostLine.deleteMany({ where: { landedCostId: lcId } });
    await prisma.landedCostExpense.deleteMany({ where: { landedCostId: lcId } });
    await prisma.landedCostReceipt.deleteMany({ where: { landedCostId: lcId } });
    await prisma.landedCost.delete({ where: { id: lcId } });
  }

  if (createdTxns.length > 0) {
    await prisma.inventoryLedgerEntry.deleteMany({ where: { transactionId: { in: createdTxns } } });
    await prisma.inventoryTransactionLine.deleteMany({ where: { transactionId: { in: createdTxns } } });
    await prisma.inventoryTransaction.deleteMany({ where: { id: { in: createdTxns } } });
  }

  if (createdPurchaseOrderLines.length > 0) {
    await prisma.purchaseOrderLine.deleteMany({ where: { id: { in: createdPurchaseOrderLines } } });
  }
  if (createdPurchaseOrders.length > 0) {
    await prisma.purchaseOrder.deleteMany({ where: { id: { in: createdPurchaseOrders } } });
  }

  if (createdLogs.length > 0) {
    await prisma.activityLog.deleteMany({ where: { id: { in: createdLogs } } });
  }

  const currentCosts = await prisma.productCost.findMany({ where: { organizationId: ORG }, select: { id: true } });
  for (const row of currentCosts) {
    if (!snap.productCost.some((c) => c.id === row.id)) {
      await prisma.productCost.delete({ where: { id: row.id } });
    }
  }
  for (const row of snap.productCost) {
    await prisma.productCost.update({
      where: { id: row.id },
      data: { averageCost: new Prisma.Decimal(row.averageCost), totalQuantity: new Prisma.Decimal(row.totalQuantity), totalValue: new Prisma.Decimal(row.totalValue) },
    });
  }

  const createdProducts = (await prisma.product.findMany({ where: { organizationId: ORG }, select: { id: true } }))
    .map((r) => r.id)
    .filter((id) => !snap.existing.products.has(id));
  if (createdProducts.length > 0) {
    await prisma.product.deleteMany({ where: { id: { in: createdProducts } } });
  }

  for (const doc of snap.documents) {
    await prisma.documentSequence.update({ where: { id: doc.id }, data: { currentSequence: doc.currentSequence } });
  }
}

async function getValues() {
  const [dash, reportRows, sourceTotal] = await Promise.all([
    dashboard.getOperationalSummary(ORG),
    report.valuation({}),
    valuation.totalValue(ORG),
  ]);
  const reportTotal = reportRows.reduce((sum, r) => sum + r.totalValue, 0);
  return { dashboardValue: dash.kpis.inventoryValue, reportTotal, sourceTotal };
}

let snap: Snapshot;
let baseline: number;
let productId: string;

beforeAll(async () => {
  snap = await snapshot();
  baseline = await valuation.totalValue(ORG);

  productId = await prisma.product
    .create({
      data: {
        organizationId: ORG,
        categoryId: CAT_BEV,
        supplierId: SUPPLIER,
        unitOfMeasureId: UOM_PC,
        sku: `E2E-FLOW-${Date.now()}`,
        name: "E2E Full Workflow Product",
        status: "ACTIVE",
        defaultSellingPrice: new Prisma.Decimal(3.0),
      },
    })
    .then((p) => p.id);
});

afterAll(async () => {
  await restore(snap);
});

describe("M5 E2E: full workflow PO → GR → LC → SO → Shipment → Invoice → Payment → Return/Credit Note keeps valuation correct", () => {
  it("PO (100 @ 1.000) + GR: valuation rises by 100", async () => {
    const po = await purchases.create(context, {
      supplierId: SUPPLIER,
      currency: "KWD",
      subtotal: 100,
      taxAmount: 0,
      totalAmount: 100,
      lines: [
        {
          productId,
          unitOfMeasureId: UOM_PC,
          orderedQuantity: 100,
          unitCost: 1.0,
          totalCost: 100.0,
        },
      ],
    });

    await purchases.submit(context, po.id);
    await purchases.approve(context, po.id);

    const gr = await receipts.receive(context, {
      purchaseOrderId: po.id,
      warehouseId: WH_MAIN,
      lines: [
        {
          purchaseOrderLineId: po.lines[0].id,
          productId,
          quantity: 100,
        },
      ],
    });
    expect(gr?.id).toBeTruthy();

    const v = await getValues();
    expect(v.dashboardValue).toBeCloseTo(baseline + 100, 3);
    expect(v.dashboardValue).toBe(v.reportTotal);
    expect(v.sourceTotal).toBeCloseTo(baseline + 100, 3);
  });

  it("LC (CUSTOMS_TAX 20): valuation rises to +120", async () => {
    const gr = await prisma.inventoryTransaction.findFirst({
      where: { organizationId: ORG, type: "PURCHASE_RECEIPT" },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    expect(gr).not.toBeNull();

    const lc = await landedCosts.create(context, {
      allocationBasis: "BY_VALUE",
      currency: "KWD",
      exchangeRate: 1,
      expenses: [{ expenseType: "CUSTOMS_TAX", currency: "KWD", exchangeRate: 1, amount: 20 }],
      receiptTransactionIds: [gr!.id],
    });
    await landedCosts.post(context, lc.id);

    const v = await getValues();
    expect(v.dashboardValue).toBeCloseTo(baseline + 120, 3);
    expect(v.dashboardValue).toBe(v.reportTotal);
    expect(v.sourceTotal).toBeCloseTo(baseline + 120, 3);

    const cost = await prisma.productCost.findFirst({
      where: { organizationId: ORG, productId },
      select: { averageCost: true, totalQuantity: true, totalValue: true },
    });
    expect(Number(cost?.averageCost)).toBeCloseTo(1.2, 3);
    expect(Number(cost?.totalValue)).toBeCloseTo(120, 3);
  });

  it("SO (50 @ 3.000) approved: valuation unchanged at +120", async () => {
    const so = await salesOrders.create(context, {
      customerId: CUSTOMER,
      currency: "KWD",
      subtotal: 150,
      taxAmount: 0,
      totalAmount: 150,
      discountAmount: 0,
      lines: [
        {
          productId,
          unitOfMeasureId: UOM_PC,
          orderedQuantity: 50,
          unitPrice: 3.0,
          totalPrice: 150.0,
          productName: "E2E Full Workflow Product",
          productSku: "E2E-FLOW",
          unitOfMeasureCode: "PC",
        },
      ],
    });

    await salesOrders.submit(context, so.order.id);
    await salesOrders.approve(context, so.order.id);

    const v = await getValues();
    expect(v.dashboardValue).toBeCloseTo(baseline + 120, 3);
    expect(v.dashboardValue).toBe(v.reportTotal);
    expect(v.sourceTotal).toBeCloseTo(baseline + 120, 3);
  });

  it("Shipment 50 delivered: COGS 60, valuation drops to +60", async () => {
    const so = await prisma.salesOrder.findFirst({
      where: { organizationId: ORG },
      orderBy: { createdAt: "desc" },
      include: { lines: true },
    });
    expect(so).not.toBeNull();
    const soLine = so!.lines[0];

    const shipment = await shipments.create(context, {
      salesOrderId: so!.id,
      warehouseId: WH_MAIN,
      lines: [
        {
          salesOrderLineId: soLine.id,
          productId,
          quantity: 50,
          productName: "E2E Full Workflow Product",
          productSku: "E2E-FLOW",
          unitOfMeasureId: UOM_PC,
          unitOfMeasureCode: "PC",
        },
      ],
    });

    const shipLine = shipment.lines[0];
    await shipments.addPickQuantity(context, shipment.id, shipLine.id, 50);
    await shipments.updateStatus(context, shipment.id, "PICKED");
    await shipments.updateStatus(context, shipment.id, "LOADED");
    await shipments.deliver(context, shipment.id);

    const v = await getValues();
    expect(v.dashboardValue).toBeCloseTo(baseline + 60, 3);
    expect(v.dashboardValue).toBe(v.reportTotal);
    expect(v.sourceTotal).toBeCloseTo(baseline + 60, 3);

    const cost = await prisma.productCost.findFirst({
      where: { organizationId: ORG, productId },
      select: { totalQuantity: true, totalValue: true },
    });
    expect(Number(cost?.totalQuantity)).toBeCloseTo(50, 3);
    expect(Number(cost?.totalValue)).toBeCloseTo(60, 3);
  });

  it("Payment 150 on invoice: SO/invoice PAID, valuation unchanged at +60", async () => {
    const invoice = await prisma.invoice.findFirst({
      where: { organizationId: ORG, status: { notIn: ["CANCELLED", "DRAFT"] } },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    expect(invoice).not.toBeNull();

    await payments.record(context, {
      invoiceId: invoice!.id,
      amount: 150,
      currency: "KWD",
      method: "BANK_TRANSFER",
    });

    const v = await getValues();
    expect(v.dashboardValue).toBeCloseTo(baseline + 60, 3);
    expect(v.dashboardValue).toBe(v.reportTotal);
    expect(v.sourceTotal).toBeCloseTo(baseline + 60, 3);

    const paidInvoice = await prisma.invoice.findFirst({
      where: { id: invoice!.id, organizationId: ORG },
      select: { status: true, amountPaid: true },
    });
    expect(paidInvoice?.status).toBe("PAID");
    expect(Number(paidInvoice?.amountPaid)).toBeCloseTo(150, 3);
  });

  it("Return 10 RESTOCK: reverses at issue cost 1.2, valuation rises to +72 (credit note 30)", async () => {
    const so = await prisma.salesOrder.findFirst({
      where: { organizationId: ORG },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    const invoice = await prisma.invoice.findFirst({
      where: { salesOrderId: so!.id, organizationId: ORG, status: { notIn: ["CANCELLED", "DRAFT"] } },
      select: { id: true },
    });
    expect(invoice).not.toBeNull();

    const returnOrder = await returns.create(context, {
      salesOrderId: so!.id,
      invoiceId: invoice!.id,
      customerId: CUSTOMER,
      reason: "CUSTOMER_CHANGED_MIND",
      lines: [
        {
          productId,
          unitOfMeasureId: UOM_PC,
          expectedQuantity: 10,
          unitPrice: 3.0,
        },
      ],
    });

    const returnLine = returnOrder.lines[0];
    await returns.receive(context, returnOrder.id, [
      { lineId: returnLine.id, receivedQuantity: 10, condition: "GOOD" },
    ]);
    await returns.complete(context, {
      id: returnOrder.id,
      warehouseId: WH_MAIN,
      lines: [{ lineId: returnLine.id, disposition: "RESTOCK", condition: "GOOD" }],
    });

    const v = await getValues();
    expect(v.dashboardValue).toBeCloseTo(baseline + 72, 3);
    expect(v.dashboardValue).toBe(v.reportTotal);
    expect(v.sourceTotal).toBeCloseTo(baseline + 72, 3);

    const cost = await prisma.productCost.findFirst({
      where: { organizationId: ORG, productId },
      select: { averageCost: true, totalQuantity: true, totalValue: true },
    });
    expect(Number(cost?.averageCost)).toBeCloseTo(1.2, 3);
    expect(Number(cost?.totalQuantity)).toBeCloseTo(60, 3);
    expect(Number(cost?.totalValue)).toBeCloseTo(72, 3);

    const creditNote = await prisma.creditNote.findFirst({
      where: { returnOrderId: returnOrder.id, organizationId: ORG },
      select: { totalAmount: true, status: true },
    });
    expect(creditNote).not.toBeNull();
    expect(Number(creditNote?.totalAmount)).toBeCloseTo(30, 3);
  });
});
