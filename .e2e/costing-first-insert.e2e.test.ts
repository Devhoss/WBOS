import { describe, it, expect, afterAll, beforeAll, vi } from "vitest";
import { Prisma } from "@prisma/client";

import { prisma } from "@/infrastructure/database/prisma";
import { CostingService } from "@/domains/inventory/services/costing-service";

/**
 * LIVE PROOF — the first receipt for a brand-new (product, warehouse) pair.
 *
 * `recordReceipt` used to read the ProductCost row, branch on `current == null`
 * and call `create()`. Two concurrent first receipts both saw null, both
 * created, and the loser surfaced a raw PostgreSQL unique-constraint violation
 * (P2002 on `product_costs_organizationId_productId_warehouseId_key`) instead
 * of any business error. The retry loop wrapped around it could never have
 * helped: a unique violation aborts the surrounding transaction, so every
 * subsequent statement in that transaction fails with 25P02.
 *
 * The fix is an upsert, which PostgreSQL executes as
 * `INSERT ... ON CONFLICT DO UPDATE`: the second writer blocks on the unique
 * index instead of failing on it, then folds its quantity in with `increment`.
 *
 * These race genuinely concurrent connections. A mocked client cannot evaluate
 * a unique index, so the invariant has to be proven here.
 */

vi.mock("@/infrastructure/request/authenticated-request-context", () => ({
  AuthenticatedRequestContextService: class {
    async getCurrentContext() {
      return { organizationId: "bootstrap-org-001", userId: "demo-system-user", role: "OWNER" };
    }
  },
}));

const ORG = "bootstrap-org-001";
const D = (v: number) => new Prisma.Decimal(v);

let uomId: string;

/**
 * Everything this file creates, so it can be removed again.
 *
 * These tests deliberately post real value into ProductCost, which is exactly
 * what `valuation-sync-e2e.test.ts` measures across the whole organization. Left
 * behind, they shift its baseline by 832.000 per run and break the suite's
 * re-runnability — the same shared-fixture trap that bit the concurrency proofs.
 */
const created = { productIds: [] as string[], warehouseIds: [] as string[] };

beforeAll(async () => {
  const prod = await prisma.product.findFirstOrThrow({ where: { organizationId: ORG } });
  uomId = prod.unitOfMeasureId;
});

afterAll(async () => {
  if (created.productIds.length === 0) return;

  const where = { productId: { in: created.productIds } };
  const transactionIds = (
    await prisma.inventoryTransactionLine.findMany({ where, select: { transactionId: true } })
  ).map((l) => l.transactionId);

  // Deepest dependants first: the ledger references both the transaction and
  // its line, and every one of them references the product.
  await prisma.inventoryLedgerEntry.deleteMany({ where });
  await prisma.inventoryTransactionLine.deleteMany({ where });
  await prisma.inventoryTransaction.deleteMany({ where: { id: { in: transactionIds } } });
  await prisma.productCost.deleteMany({ where });
  await prisma.product.deleteMany({ where: { id: { in: created.productIds } } });
  await prisma.warehouse.deleteMany({ where: { id: { in: created.warehouseIds } } });
});

/**
 * A product and warehouse used by nothing else, so the pair has genuinely
 * never been costed before — which is the only state in which the race exists.
 */
async function makeVirginPair(label: string) {
  const tag = `${label}-${Math.random().toString(36).slice(2, 8)}`;
  const category = await prisma.category.findFirst({ where: { organizationId: ORG } });

  const product = await prisma.product.create({
    data: {
      organizationId: ORG,
      sku: `COSTRACE-${tag}`,
      name: `Costing Race Product ${tag}`,
      unitOfMeasureId: uomId,
      categoryId: category?.id ?? null,
      status: "ACTIVE",
    },
  });

  const warehouse = await prisma.warehouse.create({
    data: { organizationId: ORG, code: `CST-${tag}`.slice(0, 20), name: `Costing WH ${tag}` },
  });

  created.productIds.push(product.id);
  created.warehouseIds.push(warehouse.id);

  return { productId: product.id, warehouseId: warehouse.id };
}

/** A posted movement with one ledger entry for `recordReceipt` to cost. */
async function makeLedgerEntry(productId: string, warehouseId: string, quantity: number) {
  const now = new Date();
  const tx = await prisma.inventoryTransaction.create({
    data: {
      organizationId: ORG,
      type: "PURCHASE_RECEIPT",
      occurredAt: now,
      createdById: "demo-system-user",
      lines: {
        create: [
          {
            organization: { connect: { id: ORG } },
            product: { connect: { id: productId } },
            unitOfMeasure: { connect: { id: uomId } },
            quantity,
          },
        ],
      },
    },
    include: { lines: true },
  });

  const entry = await prisma.inventoryLedgerEntry.create({
    data: {
      organizationId: ORG,
      transactionId: tx.id,
      transactionLineId: tx.lines[0].id,
      productId,
      warehouseId,
      movementType: "PURCHASE_RECEIPT",
      direction: "IN",
      quantity,
      occurredAt: now,
    },
  });

  return entry.id;
}

async function readCost(productId: string, warehouseId: string) {
  const row = await prisma.productCost.findUnique({
    where: {
      organizationId_productId_warehouseId: { organizationId: ORG, productId, warehouseId },
    },
  });
  if (!row) return null;
  return {
    quantity: Number(row.totalQuantity),
    value: Number(row.totalValue),
    average: Number(row.averageCost),
  };
}

/** Runs one receipt in its own transaction, on its own connection. */
function receipt(
  productId: string,
  warehouseId: string,
  quantity: number,
  unitCost: number,
  ledgerEntryId: string,
) {
  const service = new CostingService();
  return prisma.$transaction((tx) =>
    service.recordReceipt(
      {
        organizationId: ORG,
        productId,
        warehouseId,
        quantity: D(quantity),
        unitCost: D(unitCost),
        ledgerEntryId,
      },
      tx as never,
    ),
  );
}

describe("costing: the first receipt for a new product/warehouse pair", () => {
  it("#1 two concurrent FIRST receipts both succeed — no raw unique violation", async () => {
    const { productId, warehouseId } = await makeVirginPair("both");
    const [e1, e2] = await Promise.all([
      makeLedgerEntry(productId, warehouseId, 10),
      makeLedgerEntry(productId, warehouseId, 10),
    ]);

    expect(await readCost(productId, warehouseId)).toBeNull();

    const results = await Promise.allSettled([
      receipt(productId, warehouseId, 10, 5, e1),
      receipt(productId, warehouseId, 10, 5, e2),
    ]);

    const failed = results.filter((r) => r.status === "rejected");
    const after = await readCost(productId, warehouseId);

    console.log(
      `   [costing #1] failed=${failed.length}/2 (expect 0) ` +
        `qty=${after?.quantity} (expect 20) value=${after?.value} (expect 100) avg=${after?.average}`,
      failed.map((f) => (f as PromiseRejectedResult).reason?.message),
    );

    // Before the fix, exactly one of these rejected with
    // "Unique constraint failed on the fields: (organizationId,productId,warehouseId)".
    expect(failed).toHaveLength(0);

    // And neither contribution may be lost.
    expect(after).not.toBeNull();
    expect(after!.quantity).toBeCloseTo(20, 6);
    expect(after!.value).toBeCloseTo(100, 6);
    expect(after!.average).toBeCloseTo(5, 6);
  });

  it("#2 no P2002 / unique-violation error escapes to the caller", async () => {
    const { productId, warehouseId } = await makeVirginPair("nop2002");
    const entries = await Promise.all(
      Array.from({ length: 6 }, () => makeLedgerEntry(productId, warehouseId, 1)),
    );

    const results = await Promise.allSettled(
      entries.map((id) => receipt(productId, warehouseId, 1, 2, id)),
    );

    const reasons = results
      .filter((r) => r.status === "rejected")
      .map((r) => String((r as PromiseRejectedResult).reason?.message ?? ""));

    console.log(`   [costing #2] rejections=${reasons.length}/6 (expect 0)`, reasons);

    // The requirement is not merely "a nicer error" — it is that the operation
    // succeeds. Assert both, so a future change that swaps the raw error for a
    // BusinessError without fixing the race still fails this test.
    expect(reasons).toHaveLength(0);
    for (const message of reasons) {
      expect(message).not.toMatch(/Unique constraint|P2002|duplicate key/i);
    }
  });

  it("#3 a wide fan-out of first receipts sums exactly, losing nothing", async () => {
    const { productId, warehouseId } = await makeVirginPair("fanout");
    const entries = await Promise.all(
      Array.from({ length: 10 }, () => makeLedgerEntry(productId, warehouseId, 3)),
    );

    const results = await Promise.allSettled(
      entries.map((id) => receipt(productId, warehouseId, 3, 4, id)),
    );

    const ok = results.filter((r) => r.status === "fulfilled").length;
    const after = await readCost(productId, warehouseId);

    console.log(
      `   [costing #3] succeeded=${ok}/10 qty=${after?.quantity} (expect 30) ` +
        `value=${after?.value} (expect 120) avg=${after?.average} (expect 4)`,
    );

    expect(ok).toBe(10);
    expect(after!.quantity).toBeCloseTo(30, 6);
    expect(after!.value).toBeCloseTo(120, 6);
    expect(after!.average).toBeCloseTo(4, 6);
  });

  it("#4 the moving average is right when concurrent receipts have different costs", async () => {
    // 10 @ 5.000 and 10 @ 15.000 -> 20 units, 200.000 value, 10.000 average,
    // whichever order the two transactions commit in.
    const { productId, warehouseId } = await makeVirginPair("avg");
    const [e1, e2] = await Promise.all([
      makeLedgerEntry(productId, warehouseId, 10),
      makeLedgerEntry(productId, warehouseId, 10),
    ]);

    await Promise.all([
      receipt(productId, warehouseId, 10, 5, e1),
      receipt(productId, warehouseId, 10, 15, e2),
    ]);

    const after = await readCost(productId, warehouseId);
    console.log(
      `   [costing #4] qty=${after?.quantity} value=${after?.value} avg=${after?.average} (expect 10)`,
    );

    expect(after!.quantity).toBeCloseTo(20, 6);
    expect(after!.value).toBeCloseTo(200, 6);
    expect(after!.average).toBeCloseTo(10, 6);
  });

  it("#5 each receipt still stamps its own ledger entry with its own cost", async () => {
    // The concurrency fix must not blur per-entry costs into the average.
    const { productId, warehouseId } = await makeVirginPair("ledger");
    const [e1, e2] = await Promise.all([
      makeLedgerEntry(productId, warehouseId, 10),
      makeLedgerEntry(productId, warehouseId, 10),
    ]);

    await Promise.all([
      receipt(productId, warehouseId, 10, 5, e1),
      receipt(productId, warehouseId, 10, 15, e2),
    ]);

    const [first, second] = await Promise.all([
      prisma.inventoryLedgerEntry.findUniqueOrThrow({ where: { id: e1 } }),
      prisma.inventoryLedgerEntry.findUniqueOrThrow({ where: { id: e2 } }),
    ]);

    console.log(
      `   [costing #5] entry1 unit=${first.unitCost} total=${first.totalCost} | ` +
        `entry2 unit=${second.unitCost} total=${second.totalCost}`,
    );

    expect(Number(first.unitCost)).toBeCloseTo(5, 6);
    expect(Number(first.totalCost)).toBeCloseTo(50, 6);
    expect(Number(second.unitCost)).toBeCloseTo(15, 6);
    expect(Number(second.totalCost)).toBeCloseTo(150, 6);
  });

  it("#6 a later receipt onto an existing record still folds in correctly", async () => {
    // Guards the non-racing path the upsert also replaced.
    const { productId, warehouseId } = await makeVirginPair("sequential");
    const e1 = await makeLedgerEntry(productId, warehouseId, 10);
    const e2 = await makeLedgerEntry(productId, warehouseId, 10);

    await receipt(productId, warehouseId, 10, 5, e1);
    expect((await readCost(productId, warehouseId))!.average).toBeCloseTo(5, 6);

    await receipt(productId, warehouseId, 10, 15, e2);
    const after = await readCost(productId, warehouseId);

    console.log(
      `   [costing #6] qty=${after?.quantity} value=${after?.value} avg=${after?.average} (expect 10)`,
    );

    expect(after!.quantity).toBeCloseTo(20, 6);
    expect(after!.value).toBeCloseTo(200, 6);
    expect(after!.average).toBeCloseTo(10, 6);
  });
});
