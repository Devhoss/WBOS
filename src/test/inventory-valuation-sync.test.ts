import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

import { InventoryValuationService } from "@/domains/inventory/services/inventory-valuation-service";
import { InventoryReportService } from "@/domains/reports/services/inventory-report-service";
import { KpiService } from "@/domains/reports/services/kpi-service";
import { DashboardService } from "@/app/dashboard-service";

const { mockPrisma } = vi.hoisted(() => {
  const productCost = { findMany: vi.fn() };
  const product = { count: vi.fn(), findMany: vi.fn() };
  const purchaseOrder = { count: vi.fn(), findMany: vi.fn() };
  const shipment = { count: vi.fn(), findMany: vi.fn() };
  const shipmentLine = { findMany: vi.fn() };
  const invoice = { count: vi.fn(), findMany: vi.fn(), aggregate: vi.fn() };
  const activityLog = { findMany: vi.fn() };
  const inventoryLedgerEntry = { groupBy: vi.fn() };

  return {
    mockPrisma: {
      productCost,
      product,
      purchaseOrder,
      shipment,
      shipmentLine,
      invoice,
      activityLog,
      inventoryLedgerEntry,
    },
  };
});

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/infrastructure/request/authenticated-request-context", () => ({
  AuthenticatedRequestContextService: class {
    async getCurrentContext() {
      return { organizationId: "org-1" };
    }
  },
}));

const D = (v: number) => new Prisma.Decimal(v);

type CostRow = {
  id: string;
  productId: string;
  warehouseId: string;
  averageCost: Prisma.Decimal;
  totalQuantity: Prisma.Decimal;
  totalValue: Prisma.Decimal;
  product: { id: string; name: string; sku: string };
  warehouse: { id: string; name: string };
};

function makeCost(
  productId: string,
  avg: number,
  qty: number,
  total: number,
  warehouseId = "wh-1",
): CostRow {
  return {
    id: `${productId}-${warehouseId}`,
    productId,
    warehouseId,
    averageCost: D(avg),
    totalQuantity: D(qty),
    totalValue: D(total),
    product: { id: productId, name: `Product ${productId}`, sku: `SKU-${productId}` },
    warehouse: { id: warehouseId, name: warehouseId === "wh-1" ? "Main" : "Cold" },
  };
}

const scenarioBaseline = () => [
  makeCost("prd-010", 1.5, 15, 22.5),
  makeCost("prd-011", 0.15, 125, 18.75),
  makeCost("prd-012", 2.5, 20, 50),
];

// After a landed cost post of 60.00 (allocated to prd-010): value increases.
const scenarioAfterLandedCostPost = () => [
  makeCost("prd-010", 5.5, 15, 82.5),
  makeCost("prd-011", 0.15, 125, 18.75),
  makeCost("prd-012", 2.5, 20, 50),
];

// After landing cost cancel: reverted to baseline.
const scenarioAfterLandedCostCancel = scenarioBaseline;

// After an additional receipt: prd-013 10 @ 3.0 = 30.00.
const scenarioAfterReceipt = () => [
  ...scenarioBaseline(),
  makeCost("prd-013", 3, 10, 30),
];

// After a sale of prd-010 (10 @ 1.5) and a transfer out of prd-012:
//  - sale: prd-010 onHand 5, value 7.5
//  - transfer/adjustment: prd-012 moved to wh-2 with same unit cost, 5 units remain.
const scenarioAfterSalesTransfersAdjustments = () => [
  makeCost("prd-010", 1.5, 5, 7.5),
  makeCost("prd-011", 0.15, 125, 18.75),
  makeCost("prd-012", 2.5, 5, 12.5, "wh-1"),
  makeCost("prd-012", 2.5, 15, 37.5, "wh-2"),
];

describe("Inventory valuation single-source synchronization", () => {
  let valuationService: InventoryValuationService;
  let reportService: InventoryReportService;
  let kpiService: KpiService;
  let dashboardService: DashboardService;

  beforeEach(() => {
    vi.clearAllMocks();
    valuationService = new InventoryValuationService();
    reportService = new InventoryReportService();
    kpiService = new KpiService();
    dashboardService = new DashboardService();

    mockPrisma.product.count.mockResolvedValue(10);
    mockPrisma.purchaseOrder.count.mockResolvedValue(2);
    mockPrisma.shipment.count.mockResolvedValue(1);
    mockPrisma.invoice.count.mockResolvedValue(3);
    mockPrisma.invoice.aggregate.mockResolvedValue({ _sum: { totalAmount: D(100), amountPaid: D(40) } });
    mockPrisma.purchaseOrder.findMany.mockResolvedValue([]);
    mockPrisma.shipment.findMany.mockResolvedValue([]);
    mockPrisma.invoice.findMany.mockResolvedValue([]);
    mockPrisma.activityLog.findMany.mockResolvedValue([]);
    mockPrisma.inventoryLedgerEntry.groupBy.mockResolvedValue([]);
    mockPrisma.shipmentLine.findMany.mockResolvedValue([]);
  });

  describe("InventoryValuationService is the single source", () => {
    it("totalValue() is the sum of valuation() rows", async () => {
      const rows = scenarioBaseline();
      mockPrisma.productCost.findMany.mockResolvedValue(rows);

      const valuationRows = await valuationService.valuation("org-1");
      const total = await valuationService.totalValue("org-1");

      expect(valuationRows.map((r) => r.totalValue).reduce((a, b) => a + b, 0)).toBeCloseTo(91.25, 3);
      expect(total).toBeCloseTo(91.25, 3);
      expect(total).toBeCloseTo(
        valuationRows.reduce((sum, r) => sum + r.totalValue, 0),
        3,
      );
    });
  });

  describe("report, KPI and dashboard share the same value", () => {
    const scenarios: Array<{ name: string; rows: () => CostRow[]; expected: number }> = [
      { name: "baseline", rows: scenarioBaseline, expected: 91.25 },
      { name: "after landed cost post", rows: scenarioAfterLandedCostPost, expected: 151.25 },
      { name: "after landed cost cancel", rows: scenarioAfterLandedCostCancel, expected: 91.25 },
      { name: "after receipt", rows: scenarioAfterReceipt, expected: 121.25 },
      { name: "after sales/transfers/adjustments", rows: scenarioAfterSalesTransfersAdjustments, expected: 76.25 },
    ];

    for (const scenario of scenarios) {
      it(`dashboard == report == KPI: ${scenario.name}`, async () => {
        mockPrisma.productCost.findMany.mockResolvedValue(scenario.rows());

        const sourceTotal = await valuationService.totalValue("org-1");
        const reportRows = await reportService.valuation({});
        const reportTotal = reportRows.reduce((sum, r) => sum + r.totalValue, 0);
        const kpiCard = await kpiService.inventoryValue();
        const summary = await dashboardService.getOperationalSummary("org-1");

        expect(sourceTotal).toBeCloseTo(scenario.expected, 3);
        expect(reportTotal).toBeCloseTo(sourceTotal, 3);
        expect(Number(kpiCard.value)).toBeCloseTo(sourceTotal, 3);
        expect(summary.kpis.inventoryValue).toBeCloseTo(sourceTotal, 3);

        expect(summary.kpis.inventoryValue).toBe(reportTotal);
        expect(Number(kpiCard.value)).toBe(reportTotal);
      });
    }

    it("report rows and valuation rows are identical objects", async () => {
      mockPrisma.productCost.findMany.mockResolvedValue(scenarioBaseline());

      const reportRows = await reportService.valuation({});
      const sourceRows = await valuationService.valuation("org-1");

      expect(reportRows).toEqual(sourceRows);
    });
  });
});
