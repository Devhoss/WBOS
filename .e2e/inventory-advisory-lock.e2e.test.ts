import { describe, it, expect, beforeAll, vi } from "vitest";

import { prisma } from "@/infrastructure/database/prisma";
import { InventoryPostingService } from "@/domains/inventory/services/inventory-posting-service";

/**
 * LIVE PROOF — the negative-stock guard under genuine concurrency.
 *
 * On-hand stock is DERIVED from the append-only ledger, so "never go negative"
 * is a SUM across many rows and cannot be a row-level CHECK constraint. The
 * guard therefore serialises each (product, warehouse) pair with a
 * transaction-scoped Postgres advisory lock taken INSIDE the posting
 * transaction, so a concurrent outflow blocks in the database until the first
 * transaction commits or rolls back, and then observes its committed effect.
 *
 * This file exists to prove that claim rather than assert it: two genuinely
 * concurrent connections race. A mock cannot show this.
 */

vi.mock("@/infrastructure/request/authenticated-request-context", () => ({
  AuthenticatedRequestContextService: class {
    async getCurrentContext() {
      return { organizationId: "bootstrap-org-001", userId: "demo-system-user", role: "OWNER" };
    }
  },
}));

const ORG = "bootstrap-org-001";

let uomId: string;

beforeAll(async () => {
  const prod = await prisma.product.findFirstOrThrow({ where: { organizationId: ORG } });
  uomId = prod.unitOfMeasureId;
});

/**
 * A product and warehouse used by nothing else, so the starting balance is
 * exactly what this test puts there. Sharing demo fixtures previously made
 * assertions depend on test execution order.
 */
async function makeIsolatedPair(label: string) {
  const tag = `${label}-${Math.random().toString(36).slice(2, 8)}`;
  const category = await prisma.category.findFirst({ where: { organizationId: ORG } });

  const product = await prisma.product.create({
    data: {
      organizationId: ORG,
      sku: `ADVLOCK-${tag}`,
      name: `Advisory Lock Product ${tag}`,
      unitOfMeasureId: uomId,
      categoryId: category?.id ?? null,
    },
  });

  const warehouse = await prisma.warehouse.create({
    data: { organizationId: ORG, code: `ADV-${tag}`.slice(0, 20), name: `Advisory WH ${tag}` },
  });

  return { productId: product.id, warehouseId: warehouse.id };
}

function movement(
  productId: string,
  warehouseId: string,
  direction: "IN" | "OUT",
  quantity: number,
) {
  const type = direction === "IN" ? ("ADJUSTMENT_IN" as const) : ("ADJUSTMENT_OUT" as const);
  return {
    organizationId: ORG,
    type,
    createdById: "demo-system-user",
    lines: [
      {
        productId,
        unitOfMeasureId: uomId,
        quantity,
        unitCost: 1,
        totalCost: quantity,
        ledgerEntries: [
          {
            warehouseId,
            movementType: type,
            direction,
            quantity,
            unitCost: 1,
            totalCost: quantity,
          },
        ],
      },
    ],
  };
}

async function onHand(productId: string, warehouseId: string) {
  const rows = await prisma.inventoryLedgerEntry.groupBy({
    by: ["direction"],
    where: { organizationId: ORG, productId, warehouseId },
    _sum: { quantity: true },
  });
  const inQty = Number(rows.find((r) => r.direction === "IN")?._sum.quantity ?? 0);
  const outQty = Number(rows.find((r) => r.direction === "OUT")?._sum.quantity ?? 0);
  return inQty - outQty;
}

describe("negative-stock guard under concurrency", () => {
  it("stock=10, two concurrent OUT 7: exactly one succeeds, final stock = 3", async () => {
    const { productId, warehouseId } = await makeIsolatedPair("race");
    const service = new InventoryPostingService();

    await service.post(movement(productId, warehouseId, "IN", 10));
    expect(await onHand(productId, warehouseId)).toBe(10);

    // Genuinely concurrent: two separate connections, both in flight.
    const results = await Promise.allSettled([
      service.post(movement(productId, warehouseId, "OUT", 7)),
      service.post(movement(productId, warehouseId, "OUT", 7)),
    ]);

    const succeeded = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected");

    const finalStock = await onHand(productId, warehouseId);
    const outEntries = await prisma.inventoryLedgerEntry.count({
      where: { organizationId: ORG, productId, warehouseId, direction: "OUT" },
    });

    console.log(
      `   [advisory-lock] succeeded=${succeeded.length}/2 failed=${failed.length}/2 ` +
        `finalStock=${finalStock} outLedgerEntries=${outEntries}`,
    );

    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(1);

    // The loser failed for the right reason, not by accident.
    const reason = (failed[0] as PromiseRejectedResult).reason;
    expect(reason).toMatchObject({ code: "INVENTORY_INSUFFICIENT_STOCK" });

    expect(finalStock).toBe(3);
    expect(finalStock).toBeGreaterThanOrEqual(0);

    // The loser's transaction rolled back entirely — no orphaned ledger row.
    expect(outEntries).toBe(1);
  });

  it("leaves no inventory transaction behind when the guard rejects", async () => {
    const { productId, warehouseId } = await makeIsolatedPair("rollback");
    const service = new InventoryPostingService();

    await service.post(movement(productId, warehouseId, "IN", 5));

    await expect(service.post(movement(productId, warehouseId, "OUT", 6))).rejects.toMatchObject({
      code: "INVENTORY_INSUFFICIENT_STOCK",
    });

    const lines = await prisma.inventoryTransactionLine.count({
      where: { organizationId: ORG, productId },
    });

    console.log(
      `   [advisory-lock] transactionLines after refused OUT = ${lines} (expect 1: the IN only)`,
    );
    expect(lines).toBe(1);
    expect(await onHand(productId, warehouseId)).toBe(5);
  });

  it("serialises the same pair but NOT different pairs", async () => {
    // The lock key is (organization, product, warehouse). Unrelated pairs must
    // stay independent, otherwise the guard becomes a global write bottleneck.
    const a = await makeIsolatedPair("pair-a");
    const b = await makeIsolatedPair("pair-b");
    const service = new InventoryPostingService();

    await service.post(movement(a.productId, a.warehouseId, "IN", 10));
    await service.post(movement(b.productId, b.warehouseId, "IN", 10));

    // Both must succeed: they contend for nothing.
    const results = await Promise.allSettled([
      service.post(movement(a.productId, a.warehouseId, "OUT", 7)),
      service.post(movement(b.productId, b.warehouseId, "OUT", 7)),
    ]);

    console.log(
      `   [advisory-lock] different pairs: ` +
        `${results.filter((r) => r.status === "fulfilled").length}/2 succeeded`,
    );

    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
    expect(await onHand(a.productId, a.warehouseId)).toBe(3);
    expect(await onHand(b.productId, b.warehouseId)).toBe(3);
  });

  it("different pairs do not block each other while one pair is held", async () => {
    // Timing evidence for the claim above: hold the lock on pair A inside an
    // open transaction, then post against pair B. If the lock were coarser than
    // (product, warehouse), B would block until A commits.
    const a = await makeIsolatedPair("hold-a");
    const b = await makeIsolatedPair("hold-b");
    const service = new InventoryPostingService();

    await service.post(movement(a.productId, a.warehouseId, "IN", 10));
    await service.post(movement(b.productId, b.warehouseId, "IN", 10));

    const HOLD_MS = 3000;
    let bFinishedAt = 0;
    const startedAt = Date.now();

    const holdA = prisma.$transaction(
      async (tx) => {
        await service.post(movement(a.productId, a.warehouseId, "OUT", 7), tx);
        // Keep A's transaction — and therefore A's advisory lock — open.
        await new Promise((resolve) => setTimeout(resolve, HOLD_MS));
      },
      { timeout: 30000 },
    );

    // Give A time to actually take its lock before B starts.
    await new Promise((resolve) => setTimeout(resolve, 300));

    const postB = service
      .post(movement(b.productId, b.warehouseId, "OUT", 7))
      .then(() => {
        bFinishedAt = Date.now();
      });

    await Promise.all([holdA, postB]);

    const bElapsed = bFinishedAt - startedAt;
    console.log(
      `   [advisory-lock] pair B completed in ${bElapsed}ms while pair A held its lock for ${HOLD_MS}ms`,
    );

    // B must not have waited for A. Generous margin: the assertion is "did not
    // serialise", not a latency benchmark.
    expect(bElapsed).toBeLessThan(HOLD_MS);
    expect(await onHand(b.productId, b.warehouseId)).toBe(3);
  });

  it("holds the invariant under a wider fan-out", async () => {
    // 10 concurrent OUT 3 against stock 10 => at most 3 can succeed.
    const { productId, warehouseId } = await makeIsolatedPair("fanout");
    const service = new InventoryPostingService();

    await service.post(movement(productId, warehouseId, "IN", 10));

    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () => service.post(movement(productId, warehouseId, "OUT", 3))),
    );

    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const finalStock = await onHand(productId, warehouseId);

    console.log(`   [advisory-lock] fan-out: ${succeeded}/10 succeeded, finalStock=${finalStock}`);

    expect(succeeded).toBe(3);
    expect(finalStock).toBe(1);
    expect(finalStock).toBeGreaterThanOrEqual(0);
  });
});
