import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

const { mockPrisma } = vi.hoisted(() => {
  const landedCost = {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
  };
  const landedCostExpense = {
    createMany: vi.fn(),
    deleteMany: vi.fn(),
  };
  const landedCostLine = {
    create: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  };
  const landedCostReceipt = {
    create: vi.fn(),
    findMany: vi.fn(),
  };
  const inventoryTransaction = {
    findMany: vi.fn(),
    count: vi.fn(),
    findFirst: vi.fn(),
  };
  const product = {
    findMany: vi.fn(),
  };
  const inventoryLedgerEntry = {
    groupBy: vi.fn(),
  };
  const documentSequence = {
    upsert: vi.fn(),
  };
  const activityLog = {
    create: vi.fn(),
  };
  const landedCostAllocation = {
    createMany: vi.fn(),
    deleteMany: vi.fn(),
  };

  const tx = {
    landedCost,
    landedCostExpense,
    landedCostLine,
    landedCostReceipt,
    inventoryTransaction,
    product,
    inventoryLedgerEntry,
    documentSequence,
    activityLog,
    landedCostAllocation,
    $queryRaw: vi.fn(),
  };

  return {
    mockPrisma: {
      ...tx,
      $transaction: vi.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)),
    },
  };
});

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: mockPrisma,
}));

import { LandedCostService } from "@/domains/purchasing/services/landed-cost-service";
import { BusinessError } from "@/shared/errors/business-error";

const D = (v: number | string) => new Prisma.Decimal(v);

/**
 * MANAGER by default, deliberately.
 *
 * Recording and posting landed costs used to require FINANCE, ADMIN or OWNER —
 * MANAGER was excluded by name even though it outranked FINANCE numerically.
 * With the role model reduced to OWNER and MANAGER this is ordinary operational
 * work, so the whole suite runs as a MANAGER to prove that.
 */
function mockContext(overrides = {}) {
  return {
    organizationId: "org-1",
    userId: "user-1",
    role: "MANAGER",
    ...overrides,
  } as never;
}

/**
 * A role value that no longer exists in the enum, standing in for a stale
 * session or a hand-edited row. The guard must refuse it outright rather than
 * ranking it into permissions — which is exactly what the old numeric ladder
 * would have done.
 */
const REMOVED_ROLE = { role: "VIEWER" };

function makeLandedCost(overrides = {}) {
  return {
    id: "lc-1",
    organizationId: "org-1",
    lcNumber: "LC-2026-000001",
    supplierId: null,
    status: "DRAFT",
    allocationBasis: "BY_VALUE",
    postingDate: null,
    currency: "KWD",
    exchangeRate: D(1),
    notes: null,
    createdById: "user-1",
    postedById: null,
    cancelledById: null,
    postedAt: null,
    cancelledAt: null,
    inventoryTransactionId: null,
    createdAt: new Date("2026-08-01T10:00:00Z"),
    updatedAt: new Date("2026-08-01T10:00:00Z"),
    expenses: [],
    lines: [],
    receipts: [],
    allocations: [],
    ...overrides,
  };
}

function makePostedTransaction(overrides = {}) {
  return {
    id: "txn-1",
    organizationId: "org-1",
    type: "LANDED_COST",
    documentNumber: "LC-2026-000001",
    referenceType: "LANDED_COST",
    referenceId: "lc-1",
    occurredAt: new Date("2026-08-02T10:00:00Z"),
    lines: [
      {
        id: "txn-line-1",
        productId: "prod-1",
        unitOfMeasureId: "uom-1",
        quantity: D(0),
        ledgerEntries: [
          { id: "entry-1", warehouseId: "wh-1", movementType: "LANDED_COST", direction: "IN", quantity: D(0), totalCost: D(90) },
        ],
      },
    ],
    ...overrides,
  };
}

describe("LandedCostService", () => {
  let service: LandedCostService;
  let mockPosting: { post: ReturnType<typeof vi.fn> };
  let mockCosting: { recordRevaluation: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPosting = { post: vi.fn() };
    mockCosting = { recordRevaluation: vi.fn() };
    service = new LandedCostService(
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      mockPosting as never,
      mockCosting as never,
    );
  });

  describe("create", () => {
    it("generates an LC number, creates the document with expenses and links receipts", async () => {
      mockPrisma.documentSequence.upsert.mockResolvedValue({
        year: 2026,
        prefix: "LC",
        digits: 6,
        separator: "-",
        currentSequence: 1,
      });

      mockPrisma.landedCost.create.mockResolvedValue(makeLandedCost());
      mockPrisma.landedCost.findFirst.mockResolvedValue(makeLandedCost());

      mockPrisma.inventoryTransaction.findMany.mockResolvedValue([
        {
          id: "grn-1",
          type: "PURCHASE_RECEIPT",
          status: "POSTED",
          lines: [
            {
              id: "grn-line-1",
              productId: "prod-1",
              unitOfMeasureId: "uom-1",
              quantity: D(10),
              toWarehouseId: "wh-1",
              fromWarehouseId: null,
              ledgerEntries: [{ direction: "IN", totalCost: D(100) }],
            },
          ],
        },
      ]);

      mockPrisma.product.findMany.mockResolvedValue([
        {
          id: "prod-1",
          weightPerUnit: D(0.5),
          volumePerUnit: D(0.01),
        },
      ]);

      mockPrisma.landedCostReceipt.findMany.mockResolvedValue([]);
      mockPrisma.landedCostLine.create.mockResolvedValue({ id: "lc-line-1" });
      mockPrisma.landedCostExpense.createMany.mockResolvedValue({ count: 1 });

      await service.create(
        mockContext(),
        {
          allocationBasis: "BY_VALUE",
          currency: "KWD",
          exchangeRate: 1,
          expenses: [
            { expenseType: "OCEAN_FREIGHT", currency: "KWD", exchangeRate: 1, amount: 150 },
          ],
          receiptTransactionIds: ["grn-1"],
        },
      );

      expect(mockPrisma.documentSequence.upsert).toHaveBeenCalledWith({
        where: {
          organizationId_documentType_year: { organizationId: "org-1", documentType: "LC", year: 2026 },
        },
        update: { currentSequence: { increment: 1 } },
        create: expect.objectContaining({ documentType: "LC", prefix: "LC", currentSequence: 1 }),
      });

      expect(mockPrisma.landedCost.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          lcNumber: "LC-2026-000001",
          organizationId: "org-1",
          allocationBasis: "BY_VALUE",
          createdById: "user-1",
          supplierId: null,
          postingDate: null,
          notes: null,
          expenses: {
            create: [
              {
                organizationId: "org-1",
                expenseType: "OCEAN_FREIGHT",
                description: null,
                currency: "KWD",
                exchangeRate: D(1),
                amount: D(150),
                baseAmount: D(150),
              },
            ],
          },
        }),
        include: { expenses: true },
      });

      expect(mockPrisma.inventoryTransaction.findMany).toHaveBeenCalled();
      expect(mockPrisma.landedCostLine.create).toHaveBeenCalledTimes(1);
    });

    it("rejects a role that no longer exists in the model", async () => {
      await expect(
        service.create(
          mockContext(REMOVED_ROLE),
          {
            allocationBasis: "BY_VALUE",
            currency: "KWD",
            exchangeRate: 1,
            expenses: [{ expenseType: "OCEAN_FREIGHT", currency: "KWD", exchangeRate: 1, amount: 10 }],
            receiptTransactionIds: ["grn-1"],
          },
        ),
      ).rejects.toBeInstanceOf(BusinessError);

      expect(mockPrisma.landedCost.create).not.toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("rejects updates to non-draft documents", async () => {
      mockPrisma.landedCost.findFirst.mockResolvedValue(makeLandedCost({ status: "POSTED" }));

      await expect(
        service.update(mockContext(), "lc-1", {
          expenses: [{ expenseType: "OCEAN_FREIGHT", currency: "KWD", exchangeRate: 1, amount: 10 }],
        }),
      ).rejects.toThrow("Only draft landed costs can be edited.");
    });

    it("rejects updates when the document does not exist", async () => {
      mockPrisma.landedCost.findFirst.mockResolvedValue(null);

      await expect(
        service.update(mockContext(), "lc-missing", {
          expenses: [{ expenseType: "OCEAN_FREIGHT", currency: "KWD", exchangeRate: 1, amount: 10 }],
        }),
      ).rejects.toThrow("Landed cost was not found.");
    });
  });

  describe("linkReceipts", () => {
    it("rejects linking receipts to non-draft documents", async () => {
      mockPrisma.landedCost.findFirst.mockResolvedValue(makeLandedCost({ status: "POSTED" }));

      await expect(
        service.linkReceipts(mockContext(), "lc-1", ["grn-1"]),
      ).rejects.toThrow("Goods receipts can only be linked to draft landed costs.");
    });
  });

  describe("preview", () => {
    it("computes allocation by value and evaluates on-hand per line", async () => {
      mockPrisma.landedCost.findFirst.mockResolvedValue(
        makeLandedCost({
          expenses: [
            { id: "exp-1", expenseType: "OCEAN_FREIGHT", baseAmount: D(120) },
          ],
          lines: [
            {
              id: "lc-line-1",
              productId: "prod-1",
              warehouseId: "wh-1",
              unitOfMeasureId: "uom-1",
              quantity: D(10),
              invoiceValue: D(300),
              weightTotal: null,
              volumeTotal: null,
              allocatedAmount: D(0),
            },
            {
              id: "lc-line-2",
              productId: "prod-2",
              warehouseId: "wh-1",
              unitOfMeasureId: "uom-1",
              quantity: D(10),
              invoiceValue: D(100),
              weightTotal: null,
              volumeTotal: null,
              allocatedAmount: D(0),
            },
          ],
          allocations: [],
        }),
      );

      mockPrisma.inventoryLedgerEntry.groupBy
        .mockResolvedValueOnce([{ productId: "prod-1", warehouseId: "wh-1", direction: "IN", _sum: { quantity: D(10) } }])
        .mockResolvedValueOnce([{ productId: "prod-2", warehouseId: "wh-1", direction: "IN", _sum: { quantity: D(0) } }]);

      const result = await service.preview(mockContext(), "lc-1");

      // BY_VALUE: l1=300/400=75% -> 90; l2=100/400=25% -> 30
      expect(result.allocation.lineTotals["lc-line-1"]).toEqual(D(90));
      expect(result.allocation.lineTotals["lc-line-2"]).toEqual(D(30));
      expect(result.allocation.grandTotal).toEqual(D(120));

      expect(result.lines[0].postingTreatment).toBe("CAPITALIZED");
      expect(result.lines[1].postingTreatment).toBe("EXPENSED");
    });
  });

  describe("getById", () => {
    it("returns the document when it exists", async () => {
      mockPrisma.landedCost.findFirst.mockResolvedValue(makeLandedCost());

      const result = await service.getById(mockContext(), "lc-1");

      expect(result?.lcNumber).toBe("LC-2026-000001");
    });

    it("throws when the document does not exist", async () => {
      mockPrisma.landedCost.findFirst.mockResolvedValue(null);

      await expect(service.getById(mockContext(), "lc-missing")).rejects.toThrow(
        "Landed cost was not found.",
      );
    });
  });

  describe("list", () => {
    it("returns items and total with filters", async () => {
      mockPrisma.landedCost.findMany.mockResolvedValue([makeLandedCost()]);
      mockPrisma.landedCost.count.mockResolvedValue(1);

      const result = await service.list(mockContext(), { status: "DRAFT" });

      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(mockPrisma.landedCost.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: "org-1", status: "DRAFT" }),
        }),
      );
    });
  });

  describe("post", () => {
    function mockDraftLandedCost(overrides = {}) {
      return makeLandedCost({
        expenses: [{ id: "exp-1", expenseType: "OCEAN_FREIGHT", baseAmount: D(120) }],
        lines: [
          {
            id: "lc-line-1",
            productId: "prod-1",
            warehouseId: "wh-1",
            unitOfMeasureId: "uom-1",
            quantity: D(10),
            invoiceValue: D(300),
            weightTotal: null,
            volumeTotal: null,
            allocatedAmount: D(0),
          },
          {
            id: "lc-line-2",
            productId: "prod-2",
            warehouseId: "wh-1",
            unitOfMeasureId: "uom-1",
            quantity: D(10),
            invoiceValue: D(100),
            weightTotal: null,
            volumeTotal: null,
            allocatedAmount: D(0),
          },
        ],
        receipts: [{ id: "rec-1", inventoryTransactionId: "grn-1" }],
        allocations: [],
        ...overrides,
      });
    }

    beforeEach(() => {
      mockPrisma.$queryRaw.mockResolvedValue([{ id: "lc-1", status: "DRAFT" }]);
      mockPrisma.inventoryTransaction.count.mockResolvedValue(1);
      mockPrisma.inventoryLedgerEntry.groupBy
        .mockResolvedValueOnce([{ direction: "IN", _sum: { quantity: D(10) } }])
        .mockResolvedValueOnce([{ direction: "IN", _sum: { quantity: D(0) } }]);
      mockPrisma.landedCostAllocation.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.landedCostAllocation.createMany.mockResolvedValue({ count: 2 });
      mockPrisma.landedCostLine.update.mockResolvedValue({ id: "lc-line-1" });
      mockPrisma.landedCost.update.mockResolvedValue(makeLandedCost({ status: "POSTED" }));
      mockPrisma.activityLog.create.mockResolvedValue({ id: "log-1" });
      mockPosting.post.mockResolvedValue(makePostedTransaction());
      mockCosting.recordRevaluation.mockResolvedValue({ unitCost: D(9), totalCost: D(90) });
    });

    it("posts a draft landed cost in one transaction: ledger, costing, allocations, audit, activity log", async () => {
      mockPrisma.landedCost.findFirst.mockResolvedValue(mockDraftLandedCost());

      const result = await service.post(mockContext(), "lc-1");

      // Row lock acquired on the landed cost row
      expect(mockPrisma.$queryRaw).toHaveBeenCalled();

      // One transaction line per capitalized product-warehouse, quantity 0, direction IN
      expect(mockPosting.post).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: "org-1",
          type: "LANDED_COST",
          documentNumber: "LC-2026-000001",
          referenceType: "LANDED_COST",
          referenceId: "lc-1",
          lines: [
            expect.objectContaining({
              productId: "prod-1",
              unitOfMeasureId: "uom-1",
              quantity: D(0),
              ledgerEntries: [
                expect.objectContaining({
                  warehouseId: "wh-1",
                  movementType: "LANDED_COST",
                  direction: "IN",
                  quantity: D(0),
                }),
              ],
            }),
          ],
        }),
        expect.objectContaining({ landedCost: expect.any(Object), activityLog: expect.any(Object) }),
      );

      // Costing revalues the capitalized share (prod-2 has zero on-hand -> EXPENSED, no ledger entry)
      expect(mockCosting.recordRevaluation).toHaveBeenCalledTimes(1);
      expect(mockCosting.recordRevaluation).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: "org-1",
          productId: "prod-1",
          warehouseId: "wh-1",
          value: D(90),
          ledgerEntryId: "entry-1",
        }),
        expect.anything(),
      );

      // Allocations persisted for every line x expense
      expect(mockPrisma.landedCostAllocation.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({ lineId: "lc-line-1", expenseId: "exp-1", amount: D(90) }),
          expect.objectContaining({ lineId: "lc-line-2", expenseId: "exp-1", amount: D(30) }),
        ],
      });

      // Lines flagged with treatment + allocated amount
      expect(mockPrisma.landedCostLine.update).toHaveBeenCalledWith({
        where: { id: "lc-line-1" },
        data: expect.objectContaining({ allocatedAmount: D(90), postingTreatment: "CAPITALIZED" }),
      });
      expect(mockPrisma.landedCostLine.update).toHaveBeenCalledWith({
        where: { id: "lc-line-2" },
        data: expect.objectContaining({ allocatedAmount: D(30), postingTreatment: "EXPENSED" }),
      });

      // Document status transition + activity log inside the same transaction
      expect(mockPrisma.landedCost.update).toHaveBeenCalledWith({
        where: { id: "lc-1", organizationId: "org-1" },
        data: expect.objectContaining({
          status: "POSTED",
          postedById: "user-1",
          inventoryTransactionId: "txn-1",
        }),
      });
      expect(mockPrisma.activityLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "LANDED_COST_POSTED",
          entityType: "LandedCost",
          entityId: "lc-1",
        }),
      });

      expect(result?.status).toBe("DRAFT");
    });

    it("is idempotent: a second post attempt after the row is no longer DRAFT is rejected", async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ id: "lc-1", status: "POSTED" }]);
      mockPrisma.landedCost.findFirst.mockResolvedValue(mockDraftLandedCost());

      await expect(service.post(mockContext(), "lc-1")).rejects.toThrow(
        "Only draft landed costs can be posted.",
      );

      expect(mockPosting.post).not.toHaveBeenCalled();
      expect(mockPrisma.landedCost.update).not.toHaveBeenCalled();
    });

    it("locks the landed cost row FOR UPDATE before posting so concurrent posts serialize", async () => {
      mockPrisma.landedCost.findFirst.mockResolvedValue(mockDraftLandedCost());

      await service.post(mockContext(), "lc-1");

      const [sql] = mockPrisma.$queryRaw.mock.calls[0];
      expect(sql.strings.join("")).toContain("FOR UPDATE");
      expect(sql.strings.join("")).toContain('"landed_costs"');
      expect(sql.values).toContain("lc-1");
      expect(sql.values).toContain("org-1");
    });

    it("rejects a role that no longer exists in the model", async () => {
      mockPrisma.landedCost.findFirst.mockResolvedValue(mockDraftLandedCost());

      await expect(service.post(mockContext(REMOVED_ROLE), "lc-1")).rejects.toBeInstanceOf(
        BusinessError,
      );

      expect(mockPosting.post).not.toHaveBeenCalled();
    });

    it("rejects when a linked receipt is not a posted purchase receipt", async () => {
      mockPrisma.inventoryTransaction.count.mockResolvedValue(0);
      mockPrisma.landedCost.findFirst.mockResolvedValue(mockDraftLandedCost());

      await expect(service.post(mockContext(), "lc-1")).rejects.toThrow(
        "One or more linked goods receipts are not posted purchase receipts.",
      );

      expect(mockPosting.post).not.toHaveBeenCalled();
    });

    it("posts when every line has zero on-hand: no ledger entry, all lines EXPENSED", async () => {
      mockPrisma.inventoryLedgerEntry.groupBy
        .mockReset()
        .mockResolvedValue([{ direction: "IN", _sum: { quantity: D(0) } }]);
      mockPrisma.landedCost.findFirst.mockResolvedValue(mockDraftLandedCost());

      const result = await service.post(mockContext(), "lc-1");

      expect(mockPosting.post).not.toHaveBeenCalled();
      expect(mockCosting.recordRevaluation).not.toHaveBeenCalled();
      expect(mockPrisma.landedCost.update).toHaveBeenCalledWith({
        where: { id: "lc-1", organizationId: "org-1" },
        data: expect.objectContaining({
          status: "POSTED",
          inventoryTransactionId: null,
        }),
      });
      expect(mockPrisma.landedCostLine.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "lc-line-1" },
          data: expect.objectContaining({ postingTreatment: "EXPENSED" }),
        }),
      );
      expect(result?.status).toBe("DRAFT");
    });
  });

  describe("cancel", () => {
    function mockPostedLandedCost(overrides = {}) {
      return makeLandedCost({
        status: "POSTED",
        postedById: "user-1",
        postedAt: new Date("2026-08-02T09:00:00Z"),
        inventoryTransactionId: "txn-1",
        expenses: [{ id: "exp-1", expenseType: "OCEAN_FREIGHT", baseAmount: D(120) }],
        lines: [
          {
            id: "lc-line-1",
            productId: "prod-1",
            warehouseId: "wh-1",
            unitOfMeasureId: "uom-1",
            quantity: D(10),
            invoiceValue: D(300),
            weightTotal: null,
            volumeTotal: null,
            allocatedAmount: D(90),
          },
        ],
        receipts: [],
        allocations: [],
        ...overrides,
      });
    }

    beforeEach(() => {
      mockPrisma.$queryRaw.mockResolvedValue([{ id: "lc-1", status: "POSTED" }]);
      mockPrisma.inventoryTransaction.findFirst.mockResolvedValue(makePostedTransaction());
      mockPrisma.landedCost.update.mockResolvedValue(makeLandedCost({ status: "CANCELLED" }));
      mockPrisma.activityLog.create.mockResolvedValue({ id: "log-2" });
      mockPosting.post.mockResolvedValue(makePostedTransaction());
      mockCosting.recordRevaluation.mockResolvedValue({ unitCost: D(7), totalCost: D(-90) });
    });

    it("cancels a posted landed cost with a reversal transaction, negative revaluation, and activity log", async () => {
      mockPrisma.landedCost.findFirst.mockResolvedValue(mockPostedLandedCost());

      await service.cancel(mockContext(), "lc-1");

      // Reversal posted as a LANDED_COST with referenceType LANDED_COST_REVERSAL
      expect(mockPosting.post).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: "org-1",
          type: "LANDED_COST",
          referenceType: "LANDED_COST_REVERSAL",
          referenceId: "lc-1",
          lines: [
            expect.objectContaining({
              productId: "prod-1",
              quantity: D(0),
              ledgerEntries: [
                expect.objectContaining({
                  warehouseId: "wh-1",
                  movementType: "LANDED_COST",
                  direction: "OUT",
                  quantity: D(0),
                }),
              ],
            }),
          ],
        }),
        expect.anything(),
      );

      // Costing reverses the value (negative share)
      expect(mockCosting.recordRevaluation).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: "org-1",
          productId: "prod-1",
          warehouseId: "wh-1",
          value: D(-90),
          ledgerEntryId: "entry-1",
        }),
        expect.anything(),
      );

      expect(mockPrisma.landedCost.update).toHaveBeenCalledWith({
        where: { id: "lc-1", organizationId: "org-1" },
        data: expect.objectContaining({
          status: "CANCELLED",
          cancelledById: "user-1",
        }),
      });

      expect(mockPrisma.activityLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "LANDED_COST_CANCELLED",
          entityType: "LandedCost",
          entityId: "lc-1",
        }),
      });
    });

    it("rejects cancelling a draft document", async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ id: "lc-1", status: "DRAFT" }]);
      mockPrisma.landedCost.findFirst.mockResolvedValue(mockPostedLandedCost());

      await expect(service.cancel(mockContext(), "lc-1")).rejects.toThrow(
        "Only posted landed costs can be cancelled.",
      );

      expect(mockPosting.post).not.toHaveBeenCalled();
    });

    it("rejects a role that no longer exists in the model", async () => {
      mockPrisma.landedCost.findFirst.mockResolvedValue(mockPostedLandedCost());

      await expect(service.cancel(mockContext(REMOVED_ROLE), "lc-1")).rejects.toBeInstanceOf(
        BusinessError,
      );

      expect(mockPosting.post).not.toHaveBeenCalled();
    });
  });

  describe("listEligibleReceipts", () => {
    it("returns posted GRNs not already linked to a landed cost", async () => {
      mockPrisma.landedCostReceipt.findMany.mockResolvedValue([
        { id: "link-1", landedCostId: "lc-1", inventoryTransactionId: "grn-1" },
      ]);

      mockPrisma.inventoryTransaction.findMany.mockResolvedValue([
        {
          id: "grn-1",
          documentNumber: "GRN-000001",
          occurredAt: new Date("2026-08-01T10:00:00Z"),
          createdBy: { id: "user-1", name: "Alice", email: "alice@example.com" },
          lines: [],
        },
        {
          id: "grn-2",
          documentNumber: "GRN-000002",
          occurredAt: new Date("2026-08-02T10:00:00Z"),
          createdBy: null,
          lines: [
            {
              id: "grn-line-1",
              productId: "prod-1",
              quantity: D(10),
              toWarehouse: { id: "wh-1", name: "Main", code: "MAIN" },
              fromWarehouse: null,
              product: { id: "prod-1", sku: "SKU-1", name: "Widget" },
              ledgerEntries: [
                { direction: "IN", totalCost: D(300) },
                { direction: "OUT", totalCost: D(50) },
              ],
            },
          ],
        },
      ]);

      const result = await service.listEligibleReceipts(mockContext());

      expect(mockPrisma.inventoryTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: "org-1",
            type: "PURCHASE_RECEIPT",
            status: "POSTED",
          }),
        }),
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("grn-2");
      expect(result[0].documentNumber).toBe("GRN-000002");
      expect(result[0].lineCount).toBe(1);
      expect(result[0].lines[0]).toEqual(
        expect.objectContaining({
          productId: "prod-1",
          sku: "SKU-1",
          quantity: 10,
          warehouseName: "Main",
          receivedValue: 300,
        }),
      );
    });

    it("ignores links to CANCELLED landed costs so their receipts are eligible again", async () => {
      mockPrisma.landedCostReceipt.findMany.mockResolvedValue([]);

      mockPrisma.inventoryTransaction.findMany.mockResolvedValue([
        {
          id: "grn-1",
          documentNumber: "GRN-000001",
          occurredAt: new Date("2026-08-01T10:00:00Z"),
          createdBy: null,
          lines: [],
        },
      ]);

      const result = await service.listEligibleReceipts(mockContext());

      expect(mockPrisma.landedCostReceipt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            landedCost: { status: { in: ["DRAFT", "POSTED"] } },
          }),
        }),
      );
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("grn-1");
    });
  });

  describe("saveAllocations", () => {
    function mockManualDraft(overrides = {}) {
      return makeLandedCost({
        status: "DRAFT",
        allocationBasis: "MANUAL",
        expenses: [{ id: "exp-1", expenseType: "OCEAN_FREIGHT", baseAmount: D(120) }],
        lines: [
          {
            id: "lc-line-1",
            productId: "prod-1",
            warehouseId: "wh-1",
            unitOfMeasureId: "uom-1",
            quantity: D(10),
            invoiceValue: D(300),
            weightTotal: null,
            volumeTotal: null,
            allocatedAmount: D(0),
          },
          {
            id: "lc-line-2",
            productId: "prod-2",
            warehouseId: "wh-1",
            unitOfMeasureId: "uom-1",
            quantity: D(10),
            invoiceValue: D(100),
            weightTotal: null,
            volumeTotal: null,
            allocatedAmount: D(0),
          },
        ],
        allocations: [],
        ...overrides,
      });
    }

    it("saves manual cells and updates line allocated amounts", async () => {
      mockPrisma.landedCost.findFirst.mockResolvedValue(mockManualDraft());

      await service.saveAllocations(mockContext(), "lc-1", [
        { lineId: "lc-line-1", expenseId: "exp-1", amount: D(90) },
        { lineId: "lc-line-2", expenseId: "exp-1", amount: D(30) },
      ]);

      expect(mockPrisma.landedCostAllocation.deleteMany).toHaveBeenCalledWith({
        where: { landedCostId: "lc-1", organizationId: "org-1" },
      });

      expect(mockPrisma.landedCostAllocation.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            landedCostId: "lc-1",
            lineId: "lc-line-1",
            expenseId: "exp-1",
            amount: D(90),
          }),
          expect.objectContaining({
            landedCostId: "lc-1",
            lineId: "lc-line-2",
            expenseId: "exp-1",
            amount: D(30),
          }),
        ]),
      });

      expect(mockPrisma.landedCostLine.update).toHaveBeenCalledWith({
        where: { id: "lc-line-1" },
        data: { allocatedAmount: D(90) },
      });
    });

    it("rejects cells that do not reconcile to the expense total", async () => {
      mockPrisma.landedCost.findFirst.mockResolvedValue(mockManualDraft());

      await expect(
        service.saveAllocations(mockContext(), "lc-1", [
          { lineId: "lc-line-1", expenseId: "exp-1", amount: D(90) },
        ]),
      ).rejects.toThrow("Manual allocation for expense does not reconcile to its total.");

      expect(mockPrisma.landedCostAllocation.createMany).not.toHaveBeenCalled();
    });

    it("rejects manual allocations when the basis is not MANUAL", async () => {
      mockPrisma.landedCost.findFirst.mockResolvedValue(mockManualDraft({ allocationBasis: "BY_VALUE" }));

      await expect(
        service.saveAllocations(mockContext(), "lc-1", [
          { lineId: "lc-line-1", expenseId: "exp-1", amount: D(90) },
          { lineId: "lc-line-2", expenseId: "exp-1", amount: D(30) },
        ]),
      ).rejects.toThrow("Manual allocations can only be saved when the basis is MANUAL.");

      expect(mockPrisma.landedCostAllocation.createMany).not.toHaveBeenCalled();
    });

    it("rejects saving allocations on non-draft documents", async () => {
      mockPrisma.landedCost.findFirst.mockResolvedValue(mockManualDraft({ status: "POSTED" }));

      await expect(
        service.saveAllocations(mockContext(), "lc-1", [
          { lineId: "lc-line-1", expenseId: "exp-1", amount: D(90) },
          { lineId: "lc-line-2", expenseId: "exp-1", amount: D(30) },
        ]),
      ).rejects.toThrow("Allocations can only be saved on draft landed costs.");

      expect(mockPrisma.landedCostAllocation.createMany).not.toHaveBeenCalled();
    });
  });

  describe("preview overrides", () => {
    it("recomputes allocation when a basis override is passed", async () => {
      mockPrisma.landedCost.findFirst.mockResolvedValue(
        makeLandedCost({
          allocationBasis: "BY_VALUE",
          expenses: [{ id: "exp-1", expenseType: "OCEAN_FREIGHT", baseAmount: D(120) }],
          lines: [
            {
              id: "lc-line-1",
              productId: "prod-1",
              warehouseId: "wh-1",
              unitOfMeasureId: "uom-1",
              quantity: D(10),
              invoiceValue: D(300),
              weightTotal: null,
              volumeTotal: null,
              allocatedAmount: D(0),
            },
            {
              id: "lc-line-2",
              productId: "prod-2",
              warehouseId: "wh-1",
              unitOfMeasureId: "uom-1",
              quantity: D(10),
              invoiceValue: D(100),
              weightTotal: null,
              volumeTotal: null,
              allocatedAmount: D(0),
            },
          ],
          allocations: [],
        }),
      );

      mockPrisma.inventoryLedgerEntry.groupBy
        .mockResolvedValueOnce([{ productId: "prod-1", warehouseId: "wh-1", direction: "IN", _sum: { quantity: D(10) } }])
        .mockResolvedValueOnce([{ productId: "prod-2", warehouseId: "wh-1", direction: "IN", _sum: { quantity: D(0) } }]);

      // BY_QUANTITY: l1=10/20=50% -> 60; l2=10/20=50% -> 60
      const result = await service.preview(mockContext(), "lc-1", { basis: "BY_QUANTITY" });

      expect(result.allocation.lineTotals["lc-line-1"]).toEqual(D(60));
      expect(result.allocation.lineTotals["lc-line-2"]).toEqual(D(60));
      expect(result.allocation.grandTotal).toEqual(D(120));
    });

    it("validates manual cells passed as an override", async () => {
      mockPrisma.landedCost.findFirst.mockResolvedValue(
        makeLandedCost({
          allocationBasis: "MANUAL",
          expenses: [{ id: "exp-1", expenseType: "OCEAN_FREIGHT", baseAmount: D(120) }],
          lines: [
            {
              id: "lc-line-1",
              productId: "prod-1",
              warehouseId: "wh-1",
              unitOfMeasureId: "uom-1",
              quantity: D(10),
              invoiceValue: D(300),
              weightTotal: null,
              volumeTotal: null,
              allocatedAmount: D(0),
            },
            {
              id: "lc-line-2",
              productId: "prod-2",
              warehouseId: "wh-1",
              unitOfMeasureId: "uom-1",
              quantity: D(10),
              invoiceValue: D(100),
              weightTotal: null,
              volumeTotal: null,
              allocatedAmount: D(0),
            },
          ],
          allocations: [],
        }),
      );

      mockPrisma.inventoryLedgerEntry.groupBy
        .mockResolvedValueOnce([{ productId: "prod-1", warehouseId: "wh-1", direction: "IN", _sum: { quantity: D(10) } }])
        .mockResolvedValueOnce([{ productId: "prod-2", warehouseId: "wh-1", direction: "IN", _sum: { quantity: D(0) } }]);

      const result = await service.preview(mockContext(), "lc-1", {
        basis: "MANUAL",
        manualCells: [
          { lineId: "lc-line-1", expenseId: "exp-1", amount: D(90) },
          { lineId: "lc-line-2", expenseId: "exp-1", amount: D(30) },
        ],
      });

      expect(result.allocation.grandTotal).toEqual(D(120));
      expect(result.allocation.lineTotals["lc-line-1"]).toEqual(D(90));
    });
  });
});
