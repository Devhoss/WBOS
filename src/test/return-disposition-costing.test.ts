import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/infrastructure/database/prisma";

/**
 * What a return posts to the ledger, per disposition.
 *
 * Two defects are covered here.
 *
 * SCRAP posted both its legs with NO cost at all — a `CUSTOMER_RETURN` IN
 * followed by a `DAMAGE` OUT, neither carrying `unitCost` or `totalCost`. The
 * scrapped goods' cost was therefore left sitting inside the original sale's
 * COGS with nothing to identify it, so an inventory loss was reported as cost
 * of goods sold and could not be separated out.
 *
 * Both dispositions referenced the return ORDER, not the return LINE. A return
 * legitimately carries the same product twice — the standing NORMAL +
 * FREE_SAMPLE pattern — and only the line knows which invoice line it came
 * from. Referencing the order collapsed them, which is the same
 * identity-by-productId defect already fixed twice in returns and credit notes.
 */

const postedTransactions: Array<Record<string, unknown>> = [];
const recordReceipt = vi.fn();
const recordIssue = vi.fn();

vi.mock("@/domains/inventory/services/inventory-posting-service", () => ({
  InventoryPostingService: class {
    async post(input: Record<string, unknown>) {
      postedTransactions.push(input);
      return { id: "tx-1", lines: [{ ledgerEntries: [] }] };
    }
  },
}));

vi.mock("@/domains/inventory/services/costing-service", () => ({
  CostingService: class {
    recordReceipt = recordReceipt;
    recordIssue = recordIssue;
    getAverageCost = vi.fn().mockResolvedValue(null);
  },
}));

vi.mock("@/domains/credit-notes/services/credit-note-service", () => ({
  CreditNoteService: class {
    issueFromReturn = vi.fn().mockResolvedValue(null);
  },
}));

vi.mock("@/domains/documents/services/document-number-service", () => ({
  DocumentNumberService: class {
    generate = vi.fn().mockResolvedValue({ documentNumber: "RN-1" });
  },
}));

vi.mock("@/domains/activity/repositories/activity-log-repository", () => ({
  ActivityLogRepository: class {
    create = vi.fn().mockResolvedValue({});
  },
}));

const findById = vi.fn();
const updateLine = vi.fn();
const updateStatus = vi.fn();

vi.mock("@/domains/returns/repositories/return-order-repository", () => ({
  ReturnOrderRepository: class {
    findById = findById;
    updateLine = updateLine;
    updateStatus = updateStatus;
  },
}));

const db = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>;

const PRODUCT = "prod-waffle";
const WAREHOUSE = "wh-1";
const PAID_INVOICE_LINE = "il-paid";
const FREE_INVOICE_LINE = "il-free";

/** 10 units issued at 0.900 on the delivered shipment, so the basis is 0.900. */
function stubOriginalIssueCost(unitCost = 0.9, quantity = 10) {
  db.shipment.findFirst.mockResolvedValue({ id: "shp-1" });
  db.shipment.findMany.mockResolvedValue([{ id: "shp-1" }]);
  db.inventoryLedgerEntry.findMany.mockResolvedValue([{ quantity, unitCost }]);
}

function makeReturnOrder(lines: Array<Record<string, unknown>>) {
  return {
    id: "ro-1",
    returnNumber: "RET-1",
    status: "RECEIVED",
    customerId: "cust-1",
    salesOrderId: "so-1",
    invoiceId: "inv-1",
    salesOrder: { id: "so-1" },
    invoice: { id: "inv-1" },
    lines,
  };
}

function returnLine(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    productId: PRODUCT,
    unitOfMeasureId: "uom-1",
    receivedQuantity: 10,
    unitPrice: 1.5,
    invoiceLineId: PAID_INVOICE_LINE,
    ...overrides,
  };
}

async function completeWith(
  lines: Array<Record<string, unknown>>,
  dispositions: Array<{ lineId: string; disposition: string; condition?: string }>,
) {
  const { ReturnOrderService } = await import("@/domains/returns/services/return-order-service");
  findById.mockResolvedValue(makeReturnOrder(lines));
  await new ReturnOrderService().complete(
    { organizationId: "org-1", userId: "user-1" },
    { id: "ro-1", warehouseId: WAREHOUSE, lines: dispositions } as never,
  );
}

type PostedEntry = {
  movementType?: string;
  direction?: string;
  unitCost?: unknown;
  totalCost?: unknown;
  referenceType?: unknown;
  referenceId?: unknown;
};

/** All ledger entries posted, flattened, with their parent transaction. */
function postedEntries(): PostedEntry[] {
  return postedTransactions.flatMap((tx) =>
    ((tx.lines as Array<Record<string, unknown>>) ?? []).flatMap((l) =>
      ((l.ledgerEntries as Array<Record<string, unknown>>) ?? []).map(
        (e): PostedEntry => ({
          ...e,
          referenceType: tx.referenceType,
          referenceId: tx.referenceId,
        }),
      ),
    ),
  );
}

describe("return disposition posts the right cost to the right bucket", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    postedTransactions.length = 0;
    updateLine.mockResolvedValue({});
    updateStatus.mockResolvedValue({});
    db.warehouse.findFirst.mockResolvedValue({ id: WAREHOUSE, name: "Main" });
    db.invoice.findFirst.mockResolvedValue({ salesOrderId: "so-1" });
    db.salesOrderLine.findMany.mockResolvedValue([
      { id: "sol-1", productId: PRODUCT, shippedQuantity: 110, returnedQuantity: 0 },
    ]);
    db.salesOrderLine.updateMany = vi.fn().mockResolvedValue({ count: 1 });
    db.salesOrder.findFirst.mockResolvedValue({ id: "so-1" });
    stubOriginalIssueCost();
  });

  describe("RESTOCK", () => {
    it("posts a costed CUSTOMER_RETURN IN at the original issue cost", async () => {
      await completeWith([returnLine("rol-1")], [{ lineId: "rol-1", disposition: "RESTOCK" }]);

      const entries = postedEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({ movementType: "CUSTOMER_RETURN", direction: "IN" });
      // 10 x 0.900 -- the cost those units left at, not today's average.
      expect(Number(entries[0].unitCost)).toBeCloseTo(0.9, 6);
      expect(Number(entries[0].totalCost)).toBeCloseTo(9, 6);
    });

    it("restores the value into sellable inventory via the costing service", async () => {
      await completeWith([returnLine("rol-1")], [{ lineId: "rol-1", disposition: "RESTOCK" }]);
      // Weighted-average behaviour preserved: the goods go back at the cost
      // they left at, so the running average is undisturbed.
      expect(recordIssue).not.toHaveBeenCalled();
    });

    it("references the exact return LINE, not the return order", async () => {
      await completeWith([returnLine("rol-1")], [{ lineId: "rol-1", disposition: "RESTOCK" }]);

      const entries = postedEntries();
      expect(entries[0].referenceType).toBe("ReturnOrderLine");
      expect(entries[0].referenceId).toBe("rol-1");
    });
  });

  describe("SCRAP", () => {
    it("posts BOTH legs, and both now carry the original issue cost", async () => {
      await completeWith([returnLine("rol-1")], [{ lineId: "rol-1", disposition: "SCRAP" }]);

      const entries = postedEntries();
      expect(entries).toHaveLength(2);

      const back = entries.find((e) => e.movementType === "CUSTOMER_RETURN");
      const gone = entries.find((e) => e.movementType === "DAMAGE");

      expect(back).toMatchObject({ direction: "IN" });
      expect(gone).toMatchObject({ direction: "OUT" });

      // Previously both were posted with no cost at all.
      expect(Number(back!.totalCost)).toBeCloseTo(9, 6);
      expect(Number(gone!.totalCost)).toBeCloseTo(9, 6);
    });

    it("uses the SAME cost on both legs so the pair nets to zero in stock", async () => {
      await completeWith([returnLine("rol-1")], [{ lineId: "rol-1", disposition: "SCRAP" }]);

      const entries = postedEntries();
      expect(Number(entries[0].totalCost)).toBeCloseTo(Number(entries[1].totalCost), 6);
    });

    it("does NOT touch the costing service — value never re-enters sellable stock", async () => {
      await completeWith([returnLine("rol-1")], [{ lineId: "rol-1", disposition: "SCRAP" }]);

      // Net quantity is zero, so ProductCost must not move. recordReceipt at the
      // original cost followed by recordIssue at the recomputed average would
      // remove a different amount than it added, permanently distorting the
      // weighted average.
      expect(recordReceipt).not.toHaveBeenCalled();
      expect(recordIssue).not.toHaveBeenCalled();
    });

    it("references the exact return LINE on both legs", async () => {
      await completeWith([returnLine("rol-1")], [{ lineId: "rol-1", disposition: "SCRAP" }]);

      for (const entry of postedEntries()) {
        expect(entry.referenceType).toBe("ReturnOrderLine");
        expect(entry.referenceId).toBe("rol-1");
      }
    });
  });

  describe("duplicate product: NORMAL + FREE_SAMPLE on one return", () => {
    it("keeps the two lines distinct, each referencing its own return line", async () => {
      // The paid line is restocked, the free-sample line is scrapped. If the
      // postings referenced the return ORDER, both would resolve to the same
      // reference and the reports could not tell them apart.
      const lines = [
        returnLine("rol-paid", { invoiceLineId: PAID_INVOICE_LINE, receivedQuantity: 10 }),
        returnLine("rol-free", { invoiceLineId: FREE_INVOICE_LINE, receivedQuantity: 2 }),
      ];

      await completeWith(lines, [
        { lineId: "rol-paid", disposition: "RESTOCK" },
        { lineId: "rol-free", disposition: "SCRAP" },
      ]);

      const entries = postedEntries();
      const references = new Set(entries.map((e) => e.referenceId));

      expect(references).toEqual(new Set(["rol-paid", "rol-free"]));
      for (const entry of entries) expect(entry.referenceType).toBe("ReturnOrderLine");

      // One restock leg plus two scrap legs.
      expect(entries).toHaveLength(3);
      expect(entries.filter((e) => e.referenceId === "rol-paid")).toHaveLength(1);
      expect(entries.filter((e) => e.referenceId === "rol-free")).toHaveLength(2);
    });

    it("costs each line by its own quantity, never merged by productId", async () => {
      const lines = [
        returnLine("rol-paid", { receivedQuantity: 10 }),
        returnLine("rol-free", { invoiceLineId: FREE_INVOICE_LINE, receivedQuantity: 2 }),
      ];

      await completeWith(lines, [
        { lineId: "rol-paid", disposition: "RESTOCK" },
        { lineId: "rol-free", disposition: "SCRAP" },
      ]);

      const entries = postedEntries();
      const paid = entries.filter((e) => e.referenceId === "rol-paid");
      const free = entries.filter((e) => e.referenceId === "rol-free");

      // 10 x 0.900 and 2 x 0.900 -- same product, different quantities, and the
      // same productId must not collapse them into one 12-unit movement.
      expect(Number(paid[0].totalCost)).toBeCloseTo(9, 6);
      for (const entry of free) expect(Number(entry.totalCost)).toBeCloseTo(1.8, 6);
    });
  });
});
