import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { Prisma } from "@prisma/client";

import { DashboardService } from "@/app/dashboard-service";
import { InventoryValuationService } from "@/domains/inventory/services/inventory-valuation-service";
import { InventoryReportService } from "@/domains/reports/services/inventory-report-service";
import { LandedCostService } from "@/domains/purchasing/services/landed-cost-service";
import { ManualReceiptService } from "@/domains/inventory/services/manual-receipt-service";
import { WarehouseTransferService } from "@/domains/inventory/services/warehouse-transfer-service";
import { InventoryAdjustmentService } from "@/domains/inventory/services/inventory-adjustment-service";
import { ShipmentService } from "@/domains/sales/services/shipment-service";
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
const WH_COLD = "bootstrap-wh-02";
const UOM_PC = "bootstrap-uom-pc";

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
const landedCosts = new LandedCostService();
const receipts = new ManualReceiptService();
const transfers = new WarehouseTransferService();
const adjustments = new InventoryAdjustmentService();
const shipments = new ShipmentService();

type Snapshot = {
  productCost: Array<{ id: string; productId: string; warehouseId: string; averageCost: string; totalQuantity: string; totalValue: string }>;
  documents: Array<{ id: string; documentType: string; year: number; currentSequence: number }>;
  invoices: Array<{ id: string; deliveryStatus: string | null; warehouseName: string | null }>;
  soLines: Array<{ id: string; shippedQuantity: string }>;
  existing: {
    transactions: Set<string>;
    landedCosts: Set<string>;
    shipments: Set<string>;
    shipmentLines: Set<string>;
    activityLogs: Set<string>;
  };
};

async function snapshot(): Promise<Snapshot> {
  const [productCost, documents, invoices, soLines, transactions, landedCostRows, shipmentRows, shipmentLineRows, activityLogRows] =
    await Promise.all([
      prisma.productCost.findMany({ where: { organizationId: ORG }, select: { id: true, productId: true, warehouseId: true, averageCost: true, totalQuantity: true, totalValue: true } }),
      prisma.documentSequence.findMany({ where: { organizationId: ORG } }),
      prisma.invoice.findMany({ where: { organizationId: ORG }, select: { id: true, deliveryStatus: true, warehouseName: true } }),
      prisma.salesOrderLine.findMany({ where: { organizationId: ORG }, select: { id: true, shippedQuantity: true } }),
      prisma.inventoryTransaction.findMany({ where: { organizationId: ORG }, select: { id: true } }),
      prisma.landedCost.findMany({ where: { organizationId: ORG }, select: { id: true } }),
      prisma.shipment.findMany({ where: { organizationId: ORG }, select: { id: true } }),
      prisma.shipmentLine.findMany({ where: { organizationId: ORG }, select: { id: true } }),
      prisma.activityLog.findMany({ where: { organizationId: ORG }, select: { id: true } }),
    ]);

  return {
    productCost: productCost.map((c) => ({
      ...c,
      averageCost: c.averageCost.toString(),
      totalQuantity: c.totalQuantity.toString(),
      totalValue: c.totalValue.toString(),
    })),
    documents: documents.map((d) => ({ id: d.id, documentType: d.documentType, year: d.year, currentSequence: d.currentSequence })),
    invoices: invoices.map((i) => ({ id: i.id, deliveryStatus: i.deliveryStatus, warehouseName: i.warehouseName })),
    soLines: soLines.map((l) => ({ id: l.id, shippedQuantity: l.shippedQuantity.toString() })),
    existing: {
      transactions: new Set(transactions.map((t) => t.id)),
      landedCosts: new Set(landedCostRows.map((l) => l.id)),
      shipments: new Set(shipmentRows.map((s) => s.id)),
      shipmentLines: new Set(shipmentLineRows.map((s) => s.id)),
      activityLogs: new Set(activityLogRows.map((a) => a.id)),
    },
  };
}

async function restore(snap: Snapshot) {
  const createdTxns = (await prisma.inventoryTransaction.findMany({ where: { organizationId: ORG }, select: { id: true } }))
    .map((t) => t.id)
    .filter((id) => !snap.existing.transactions.has(id));
  const createdLcs = (await prisma.landedCost.findMany({ where: { organizationId: ORG }, select: { id: true } }))
    .map((l) => l.id)
    .filter((id) => !snap.existing.landedCosts.has(id));
  const createdShipments = (await prisma.shipment.findMany({ where: { organizationId: ORG }, select: { id: true } }))
    .map((s) => s.id)
    .filter((id) => !snap.existing.shipments.has(id));

  await prisma.inventoryLedgerEntry.deleteMany({ where: { organizationId: ORG, transactionId: { in: createdTxns } } });
  await prisma.inventoryTransactionLine.deleteMany({ where: { organizationId: ORG, transactionId: { in: createdTxns } } });
  await prisma.inventoryTransaction.deleteMany({ where: { organizationId: ORG, id: { in: createdTxns } } });

  for (const lcId of createdLcs) {
    await prisma.landedCostAllocation.deleteMany({ where: { landedCostId: lcId } });
    await prisma.landedCostLine.deleteMany({ where: { landedCostId: lcId } });
    await prisma.landedCostExpense.deleteMany({ where: { landedCostId: lcId } });
    await prisma.landedCostReceipt.deleteMany({ where: { landedCostId: lcId } });
    await prisma.landedCost.delete({ where: { id: lcId } });
  }

  if (createdShipments.length > 0) {
    await prisma.shipmentLine.deleteMany({ where: { shipmentId: { in: createdShipments } } });
    await prisma.shipment.deleteMany({ where: { id: { in: createdShipments } } });
  }

  const createdLogs = (await prisma.activityLog.findMany({ where: { organizationId: ORG }, select: { id: true } }))
    .map((a) => a.id)
    .filter((id) => !snap.existing.activityLogs.has(id));
  await prisma.activityLog.deleteMany({ where: { id: { in: createdLogs } } });

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

  for (const line of snap.soLines) {
    await prisma.salesOrderLine.update({ where: { id: line.id }, data: { shippedQuantity: new Prisma.Decimal(line.shippedQuantity) } });
  }
  for (const inv of snap.invoices) {
    await prisma.invoice.update({ where: { id: inv.id }, data: { deliveryStatus: inv.deliveryStatus, warehouseName: inv.warehouseName } });
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

beforeAll(async () => {
  snap = await snapshot();
  const baseline = await valuation.totalValue(ORG);
  expect(baseline).toBeCloseTo(600.75, 3);
});

afterAll(async () => {
  await restore(snap);
});

describe("M5 E2E: dashboard Inventory Value == Inventory Valuation report (live DB)", () => {
  it("baseline: dashboard == report == 600.75", async () => {
    const v = await getValues();
    expect(v.dashboardValue).toBeCloseTo(600.75, 3);
    expect(v.dashboardValue).toBe(v.reportTotal);
    expect(v.sourceTotal).toBeCloseTo(600.75, 3);
  });

  it("after landed cost post: both rise to 660.75", async () => {
    const created = await landedCosts.create(context, {
      allocationBasis: "BY_VALUE",
      currency: "KWD",
      exchangeRate: 1,
      expenses: [{ expenseType: "CUSTOMS_TAX", currency: "KWD", exchangeRate: 1, amount: 60 }],
      receiptTransactionIds: ["demo-tx-demo-grn-004"],
    });

    await landedCosts.post(context, created.id);

    const v = await getValues();
    expect(v.dashboardValue).toBeCloseTo(660.75, 3);
    expect(v.dashboardValue).toBe(v.reportTotal);
    expect(v.sourceTotal).toBeCloseTo(660.75, 3);
  });

  it("after landed cost cancel: both back to 600.75", async () => {
    const lc = await prisma.landedCost.findFirst({
      where: { organizationId: ORG, status: "POSTED" },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    expect(lc).not.toBeNull();

    await landedCosts.cancel(context, lc!.id);

    const v = await getValues();
    expect(v.dashboardValue).toBeCloseTo(600.75, 3);
    expect(v.dashboardValue).toBe(v.reportTotal);
    expect(v.sourceTotal).toBeCloseTo(600.75, 3);
  });

  it("after manual receipt (prd-013 10 @ 3.0): both rise to 630.75", async () => {
    await receipts.receive(context, {
      warehouseId: WH_MAIN,
      lines: [{ productId: "demo-prd-013", quantity: 10, unitCost: 3.0 }],
    });

    const v = await getValues();
    expect(v.dashboardValue).toBeCloseTo(630.75, 3);
    expect(v.dashboardValue).toBe(v.reportTotal);
    expect(v.sourceTotal).toBeCloseTo(630.75, 3);
  });

  it("after sale/COGS (ship prd-007 5 @ 0.15): both drop to 630.00", async () => {
    const shipment = await shipments.create(context, {
      salesOrderId: "demo-so-001",
      warehouseId: WH_MAIN,
      lines: [
        {
          salesOrderLineId: "so-line-demo-so-001-03",
          productId: "demo-prd-007",
          quantity: 5,
          productName: "Lay's Chips 45g",
          productSku: "LAYS-45",
          unitOfMeasureId: UOM_PC,
          unitOfMeasureCode: "PC",
        },
      ],
    });

    const shipLine = shipment.lines[0];
    await shipments.addPickQuantity(context, shipment.id, shipLine.id, 5);
    await shipments.updateStatus(context, shipment.id, "PICKED");
    await shipments.updateStatus(context, shipment.id, "LOADED");
    await shipments.deliver(context, shipment.id);

    const v = await getValues();
    expect(v.dashboardValue).toBeCloseTo(630.0, 3);
    expect(v.dashboardValue).toBe(v.reportTotal);
    expect(v.sourceTotal).toBeCloseTo(630.0, 3);
  });

  it("after warehouse transfer (prd-012 5 wh-01→wh-02): total unchanged at 630.00", async () => {
    await transfers.transfer(context, {
      sourceWarehouseId: WH_MAIN,
      destinationWarehouseId: WH_COLD,
      lines: [{ productId: "demo-prd-012", quantity: 5 }],
    });

    const v = await getValues();
    expect(v.dashboardValue).toBeCloseTo(630.0, 3);
    expect(v.dashboardValue).toBe(v.reportTotal);
    expect(v.sourceTotal).toBeCloseTo(630.0, 3);

    const rows = await report.valuation({});
    expect(rows.some((r) => r.warehouseId === WH_COLD && r.productId === "demo-prd-012")).toBe(true);
  });

  it("after adjustment OUT (prd-010 2 @ 1.5): both drop to 627.00", async () => {
    await adjustments.adjust(context, {
      warehouseId: WH_MAIN,
      productId: "demo-prd-010",
      direction: "OUT",
      quantity: 2,
      reasonCode: "DAMAGE",
    });

    const v = await getValues();
    expect(v.dashboardValue).toBeCloseTo(627.0, 3);
    expect(v.dashboardValue).toBe(v.reportTotal);
    expect(v.sourceTotal).toBeCloseTo(627.0, 3);
  });

  it("after adjustment IN (prd-011 10 @ 0.15): both rise to 628.50", async () => {
    await adjustments.adjust(context, {
      warehouseId: WH_MAIN,
      productId: "demo-prd-011",
      direction: "IN",
      quantity: 10,
      reasonCode: "FOUND",
    });

    const v = await getValues();
    expect(v.dashboardValue).toBeCloseTo(628.5, 3);
    expect(v.dashboardValue).toBe(v.reportTotal);
    expect(v.sourceTotal).toBeCloseTo(628.5, 3);
  });
});
