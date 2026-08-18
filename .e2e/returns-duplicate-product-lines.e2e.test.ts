import { describe, it, expect, beforeAll, vi } from "vitest";

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

beforeAll(async () => {
  const prod = await prisma.product.findFirstOrThrow({ where: { organizationId: ORG } });
  const wh = await prisma.warehouse.findFirstOrThrow({ where: { organizationId: ORG } });
  const cust = await prisma.customer.findFirstOrThrow({ where: { organizationId: ORG } });
  productId = prod.id;
  uomId = prod.unitOfMeasureId;
  warehouseId = wh.id;
  customerId = cust.id;
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

    expect(second.id).toBeTruthy();
  });
});
