import { describe, it, expect, afterAll, beforeAll, vi } from "vitest";

import { prisma } from "@/infrastructure/database/prisma";
import { ReturnOrderService } from "@/domains/returns/services/return-order-service";

/**
 * REGRESSION: returns must never be credited by productId alone.
 *
 * Duplicate product lines are an intentional business pattern — a NORMAL paid
 * line and a FREE_SAMPLE line for the same product coexist on one order
 * (e.g. 100 sold + 10 free). Matching on `{ salesOrderId, productId }` credited
 * the returned quantity to BOTH lines, double-counting the return and
 * corrupting the `shipped - returned` availability guard for later returns.
 *
 * Shaped after real production data (SO-2026-000012).
 */

vi.mock("@/infrastructure/request/authenticated-request-context", () => ({
  AuthenticatedRequestContextService: class {
    async getCurrentContext() {
      return { organizationId: "bootstrap-org-001", userId: "demo-system-user", role: "OWNER" };
    }
  },
}));

const ORG = "bootstrap-org-001";
const ctx = { organizationId: ORG, userId: "demo-system-user" };

let productId: string;
let uomId: string;
let warehouseId: string;
let customerId: string;

const created = { salesOrderIds: [] as string[], returnOrderIds: [] as string[] };

/**
 * Its OWN product and warehouse.
 *
 * This file used to borrow the first demo product and warehouse. Completing a
 * RESTOCK return calls `CostingService.recordReceipt`, so every run permanently
 * added value to a demo product's ProductCost row — 0.500 per run. Nothing in
 * this file noticed, but `valuation-sync-e2e` asserts an absolute organisation
 * baseline of 600.750, so from the third consecutive run on one database its
 * `beforeAll` failed and all eight of its tests SKIPPED. A skipped suite still
 * reads as green in the summary line.
 */
beforeAll(async () => {
  const prod = await prisma.product.findFirstOrThrow({ where: { organizationId: ORG } });
  const cust = await prisma.customer.findFirstOrThrow({ where: { organizationId: ORG } });
  const category = await prisma.category.findFirst({ where: { organizationId: ORG } });
  const tag = Math.random().toString(36).slice(2, 8);

  uomId = prod.unitOfMeasureId;
  customerId = cust.id;

  const isolated = await prisma.product.create({
    data: {
      organizationId: ORG, sku: `DUPFX-${tag}`, name: `Duplicate Lines Product ${tag}`,
      unitOfMeasureId: uomId, categoryId: category?.id ?? null, status: "ACTIVE",
    },
  });
  const warehouse = await prisma.warehouse.create({
    data: { organizationId: ORG, code: `DUP-${tag}`.slice(0, 20), name: `Duplicate Lines WH ${tag}` },
  });

  productId = isolated.id;
  warehouseId = warehouse.id;
});

afterAll(async () => {
  if (!productId) return;
  const where = { productId };

  const txIds = (
    await prisma.inventoryTransactionLine.findMany({ where, select: { transactionId: true } })
  ).map((l) => l.transactionId);

  await prisma.inventoryLedgerEntry.deleteMany({ where });
  await prisma.inventoryTransactionLine.deleteMany({ where });
  await prisma.inventoryTransaction.deleteMany({ where: { id: { in: txIds } } });
  await prisma.productCost.deleteMany({ where });

  await prisma.creditNoteLine.deleteMany({ where });
  await prisma.creditNote.deleteMany({ where: { organizationId: ORG, returnOrderId: { in: created.returnOrderIds } } });
  await prisma.returnOrderLine.deleteMany({ where: { returnOrderId: { in: created.returnOrderIds } } });
  await prisma.returnOrder.deleteMany({ where: { id: { in: created.returnOrderIds } } });
  await prisma.shipmentLine.deleteMany({ where });
  await prisma.shipment.deleteMany({ where: { salesOrderId: { in: created.salesOrderIds } } });
  await prisma.salesOrderLine.deleteMany({ where: { salesOrderId: { in: created.salesOrderIds } } });
  await prisma.salesOrder.deleteMany({ where: { id: { in: created.salesOrderIds } } });

  await prisma.product.deleteMany({ where: { id: productId } });
  await prisma.warehouse.deleteMany({ where: { id: warehouseId } });
});

/** 100 NORMAL + 10 FREE_SAMPLE of the same product, both fully shipped. */
async function makePaidPlusFreeOrder() {
  const tag = Math.random().toString(36).slice(2, 8);

  const so = await prisma.salesOrder.create({
    data: {
      organizationId: ORG, soNumber: `SO-DUP-${tag}`, customerId,
      status: "INVOICED", currency: "KWD",
      subtotal: 30, taxAmount: 0, discountAmount: 0, totalAmount: 30,
      createdById: ctx.userId, orderedAt: new Date(),
      lines: {
        create: [
          {
            organizationId: ORG, productId, unitOfMeasureId: uomId, lineNumber: 1,
            orderedQuantity: 100, shippedQuantity: 100, unitPrice: 0.3, totalPrice: 30,
            lineType: "NORMAL",
            productName: "Waffle mixed berries", productSku: `DUP-${tag}`, unitOfMeasureCode: "PC",
          },
          {
            organizationId: ORG, productId, unitOfMeasureId: uomId, lineNumber: 2,
            orderedQuantity: 10, shippedQuantity: 10, unitPrice: 0, totalPrice: 0,
            lineType: "FREE_SAMPLE",
            productName: "Waffle mixed berries", productSku: `DUP-${tag}`, unitOfMeasureCode: "PC",
          },
        ],
      },
    },
    include: { lines: { orderBy: { lineNumber: "asc" } } },
  });
  created.salesOrderIds.push(so.id);

  // A delivered shipment is required before a return may be created.
  await prisma.shipment.create({
    data: {
      organizationId: ORG, shipmentNumber: `SHP-DUP-${tag}`, salesOrderId: so.id,
      warehouseId, status: "DELIVERED", deliveredAt: new Date(), createdById: ctx.userId,
    },
  });

  return so;
}

describe("returns against an order with duplicate product lines", () => {
  it("credits ONE line only, never both paid and free-sample lines", async () => {
    const so = await makePaidPlusFreeOrder();
    const paidLine = so.lines[0];
    const freeLine = so.lines[1];

    const service = new ReturnOrderService();
    const returnOrder = await service.create(ctx, {
      customerId,
      salesOrderId: so.id,
      reason: "DAMAGED",
      lines: [{ productId, unitOfMeasureId: uomId, expectedQuantity: 5, unitPrice: 0.3 }],
    } as never);

    const rLine = await prisma.returnOrderLine.findFirstOrThrow({
      where: { returnOrderId: returnOrder.id },
    });
    created.returnOrderIds.push(returnOrder.id);

    await service.receive(ctx, returnOrder.id, [
      { lineId: rLine.id, receivedQuantity: 5, condition: "GOOD" },
    ]);

    await service.complete(ctx, {
      id: returnOrder.id,
      warehouseId,
      lines: [{ lineId: rLine.id, receivedQuantity: 5, disposition: "RESTOCK", condition: "GOOD" }],
    } as never);

    const paid = await prisma.salesOrderLine.findFirstOrThrow({ where: { id: paidLine.id } });
    const free = await prisma.salesOrderLine.findFirstOrThrow({ where: { id: freeLine.id } });

    const totalCredited = Number(paid.returnedQuantity) + Number(free.returnedQuantity);
    console.log(
      `   [returns] paidLine.returned=${Number(paid.returnedQuantity)} ` +
        `freeLine.returned=${Number(free.returnedQuantity)} total=${totalCredited} (returned 5)`,
    );

    // The whole point: exactly the returned quantity is credited across the
    // order, not once per matching product line.
    expect(totalCredited).toBe(5);

    // And no line may be credited beyond what it actually shipped.
    expect(Number(paid.returnedQuantity)).toBeLessThanOrEqual(Number(paid.shippedQuantity));
    expect(Number(free.returnedQuantity)).toBeLessThanOrEqual(Number(free.shippedQuantity));
  });

  it("leaves remaining returnable quantity correct for a second return", async () => {
    // The old bug consumed availability twice, so a legitimate later return was
    // wrongly rejected. 110 shipped, 5 returned => 105 must remain returnable.
    const so = await makePaidPlusFreeOrder();
    const service = new ReturnOrderService();

    const first = await service.create(ctx, {
      customerId, salesOrderId: so.id, reason: "DAMAGED",
      lines: [{ productId, unitOfMeasureId: uomId, expectedQuantity: 5, unitPrice: 0.3 }],
    } as never);
    const firstLine = await prisma.returnOrderLine.findFirstOrThrow({
      where: { returnOrderId: first.id },
    });
    created.returnOrderIds.push(first.id);
    await service.receive(ctx, first.id, [
      { lineId: firstLine.id, receivedQuantity: 5, condition: "GOOD" },
    ]);
    await service.complete(ctx, {
      id: first.id, warehouseId,
      lines: [{ lineId: firstLine.id, receivedQuantity: 5, disposition: "RESTOCK", condition: "GOOD" }],
    } as never);

    // Must not throw RETURN_EXCEEDS_AVAILABLE.
    const second = await service.create(ctx, {
      customerId, salesOrderId: so.id, reason: "DAMAGED",
      lines: [{ productId, unitOfMeasureId: uomId, expectedQuantity: 105, unitPrice: 0.3 }],
    } as never);
    created.returnOrderIds.push(second.id);

    expect(second.id).toBeTruthy();
  });
});
