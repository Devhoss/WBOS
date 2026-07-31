import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import { CostingService } from "@/domains/inventory/services/costing-service";

const { mockProductCost, mockLedgerEntry } = vi.hoisted(() => ({
  mockProductCost: {
    findUnique: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
  mockLedgerEntry: {
    update: vi.fn(),
  },
}));

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    productCost: mockProductCost,
    inventoryLedgerEntry: mockLedgerEntry,
    $transaction: vi.fn(),
  },
}));

const D = (v: number) => new Prisma.Decimal(v);

function makeCost(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "cost-1",
    organizationId: "org-1",
    productId: "prod-1",
    warehouseId: "wh-1",
    averageCost: D(5),
    totalQuantity: D(10),
    totalValue: D(50),
    updatedAt: new Date("2026-07-30T10:00:00Z"),
    ...overrides,
  };
}

describe("CostingService", () => {
  let service: CostingService;
  let tx: Record<string, unknown>;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CostingService();
    tx = {
      productCost: mockProductCost,
      inventoryLedgerEntry: mockLedgerEntry,
    };
  });

  describe("recordReceipt", () => {
    it("creates ProductCost and updates ledger on first receipt", async () => {
      mockProductCost.findUnique.mockResolvedValue(null);
      mockProductCost.create.mockResolvedValue({ id: "new-cost" });

      await service.recordReceipt(
        {
          organizationId: "org-1",
          productId: "prod-1",
          warehouseId: "wh-1",
          quantity: D(10),
          unitCost: D(5),
          ledgerEntryId: "entry-1",
        },
        tx as never,
      );

      expect(mockProductCost.create).toHaveBeenCalledWith({
        data: {
          organizationId: "org-1",
          productId: "prod-1",
          warehouseId: "wh-1",
          averageCost: D(5),
          totalQuantity: D(10),
          totalValue: D(50),
        },
      });

      expect(mockLedgerEntry.update).toHaveBeenCalledWith({
        where: { id: "entry-1" },
        data: { unitCost: D(5), totalCost: D(50) },
      });
    });

    it("updates weighted average on subsequent receipt", async () => {
      mockProductCost.findUnique.mockResolvedValue(makeCost());
      mockProductCost.updateMany.mockResolvedValue({ count: 1 });

      await service.recordReceipt(
        {
          organizationId: "org-1",
          productId: "prod-1",
          warehouseId: "wh-1",
          quantity: D(10),
          unitCost: D(15),
          ledgerEntryId: "entry-2",
        },
        tx as never,
      );

      // Old: 10qty @ $5 = $50. Receipt: 10qty @ $15 = $150. New avg = $200/20 = $10.
      expect(mockProductCost.updateMany).toHaveBeenCalledWith({
        where: { id: "cost-1", updatedAt: new Date("2026-07-30T10:00:00Z") },
        data: {
          averageCost: D(10),
          totalQuantity: D(20),
          totalValue: D(200),
        },
      });

      expect(mockLedgerEntry.update).toHaveBeenCalledWith({
        where: { id: "entry-2" },
        data: { unitCost: D(15), totalCost: D(150) },
      });
    });

    it("retries on concurrent update, then succeeds", async () => {
      const staleUpdatedAt = new Date("2026-07-30T10:00:00Z");
      const freshUpdatedAt = new Date("2026-07-30T10:00:01Z");

      mockProductCost.findUnique
        .mockResolvedValueOnce(makeCost({ updatedAt: staleUpdatedAt }))
        .mockResolvedValueOnce(makeCost({ updatedAt: freshUpdatedAt }));

      mockProductCost.updateMany.mockResolvedValueOnce({ count: 0 });
      mockProductCost.updateMany.mockResolvedValueOnce({ count: 1 });

      await service.recordReceipt(
        {
          organizationId: "org-1",
          productId: "prod-1",
          warehouseId: "wh-1",
          quantity: D(5),
          unitCost: D(10),
          ledgerEntryId: "entry-3",
        },
        tx as never,
      );

      expect(mockProductCost.updateMany).toHaveBeenCalledTimes(2);

      expect(mockProductCost.updateMany).toHaveBeenNthCalledWith(1, {
        where: { id: "cost-1", updatedAt: staleUpdatedAt },
        data: expect.any(Object),
      });

      expect(mockProductCost.updateMany).toHaveBeenNthCalledWith(2, {
        where: { id: "cost-1", updatedAt: freshUpdatedAt },
        data: expect.any(Object),
      });

      expect(mockLedgerEntry.update).toHaveBeenCalledTimes(1);
    });

    it("throws after exhausting retries", async () => {
      mockProductCost.findUnique.mockResolvedValue(makeCost());
      mockProductCost.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.recordReceipt(
          {
            organizationId: "org-1",
            productId: "prod-1",
            warehouseId: "wh-1",
            quantity: D(5),
            unitCost: D(10),
            ledgerEntryId: "entry-4",
          },
          tx as never,
        ),
      ).rejects.toThrow("Cost record was modified concurrently");

      expect(mockProductCost.updateMany).toHaveBeenCalledTimes(3);
    });
  });

  describe("recordIssue", () => {
    it("records COGS at current average and reduces ProductCost", async () => {
      mockProductCost.findUnique.mockResolvedValue(makeCost());
      mockProductCost.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.recordIssue(
        {
          organizationId: "org-1",
          productId: "prod-1",
          warehouseId: "wh-1",
          quantity: D(4),
          ledgerEntryId: "entry-5",
        },
        tx as never,
      );

      expect(result).toEqual({ unitCost: D(5), totalCost: D(20) });

      expect(mockProductCost.updateMany).toHaveBeenCalledWith({
        where: { id: "cost-1", updatedAt: new Date("2026-07-30T10:00:00Z") },
        data: {
          totalQuantity: D(6),
          totalValue: D(30),
        },
      });

      expect(mockLedgerEntry.update).toHaveBeenCalledWith({
        where: { id: "entry-5" },
        data: { unitCost: D(5), totalCost: D(20) },
      });
    });

    it("preserves averageCost when stock reaches zero", async () => {
      mockProductCost.findUnique.mockResolvedValue(makeCost({ totalQuantity: D(5), totalValue: D(25) }));
      mockProductCost.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.recordIssue(
        {
          organizationId: "org-1",
          productId: "prod-1",
          warehouseId: "wh-1",
          quantity: D(5),
          ledgerEntryId: "entry-6",
        },
        tx as never,
      );

      expect(result).toEqual({ unitCost: D(5), totalCost: D(25) });

      expect(mockProductCost.updateMany).toHaveBeenCalledWith({
        where: expect.any(Object),
        data: {
          totalQuantity: D(0),
          totalValue: D(0),
        },
      });
    });

    it("returns zero cost when no ProductCost exists", async () => {
      mockProductCost.findUnique.mockResolvedValue(null);

      const result = await service.recordIssue(
        {
          organizationId: "org-1",
          productId: "prod-1",
          warehouseId: "wh-1",
          quantity: D(5),
          ledgerEntryId: "entry-7",
        },
        tx as never,
      );

      expect(result).toEqual({ unitCost: D(0), totalCost: D(0) });
      expect(mockProductCost.create).not.toHaveBeenCalled();
      expect(mockProductCost.updateMany).not.toHaveBeenCalled();
    });
  });

  describe("getAverageCost", () => {
    it("returns average cost when ProductCost exists", async () => {
      mockProductCost.findUnique.mockResolvedValue(makeCost());

      const result = await service.getAverageCost("org-1", "prod-1", "wh-1");

      expect(result).toEqual(D(5));
    });

    it("returns null when no ProductCost exists", async () => {
      mockProductCost.findUnique.mockResolvedValue(null);

      const result = await service.getAverageCost("org-1", "prod-1", "wh-1");

      expect(result).toBeNull();
    });
  });
});
