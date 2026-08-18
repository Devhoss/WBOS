import { describe, it, expect, beforeAll, vi } from "vitest";

import { prisma } from "@/infrastructure/database/prisma";
import { ShipmentService } from "@/domains/sales/services/shipment-service";
import { GoodsReceiptService } from "@/domains/purchasing/services/goods-receipt-service";
import { InventoryPostingService } from "@/domains/inventory/services/inventory-posting-service";
import { PaymentService } from "@/domains/sales/services/payment-service";

/**
 * LIVE CONCURRENCY PROOFS — audit findings #3 and #4.
 *
 * These run real service code against a real PostgreSQL 17 with genuinely
 * concurrent connections (Promise.all over separate queries). No mocks, no
 * simulated interleaving.
 *
 * They assert the CORRECT invariants and are expected to FAIL today.
 */

vi.mock("@/infrastructure/request/authenticated-request-context", () => ({
  AuthenticatedRequestContextService: class {
    async getCurrentContext() {
      return { organizationId: "bootstrap-org-001", userId: "demo-system-user", role: "OWNER" };
    }
  },
}));

const ORG = "bootstrap-org-001";
const ctx = {
  organizationId: ORG,
  userId: "demo-system-user",
  role: "OWNER",
  user: { id: "demo-system-user", name: "Race Tester", email: "race@example.com" },
  organization: { id: ORG, timezone: "Asia/Kuwait" },
} as never;

let warehouseId: string;
let productId: string;
let uomId: string;

beforeAll(async () => {
  const wh = await prisma.warehouse.findFirstOrThrow({ where: { organizationId: ORG } });
  const prod = await prisma.product.findFirstOrThrow({ where: { organizationId: ORG } });
  warehouseId = wh.id;
  productId = prod.id;
  uomId = prod.unitOfMeasureId;
});

/** Build an isolated shipment + backing sales order for one test. */
async function makeShipment(status: "PICKING" | "LOADED", qty: number, picked: number) {
  const tag = Math.random().toString(36).slice(2, 8);
  const customer = await prisma.customer.findFirstOrThrow({ where: { organizationId: ORG } });

  const so = await prisma.salesOrder.create({
    data: {
      organizationId: ORG, soNumber: `SO-RACE-${tag}`, customerId: customer.id,
      status: "APPROVED", currency: "KWD",
      subtotal: 0, taxAmount: 0, discountAmount: 0, totalAmount: 0,
      createdById: ctx.userId, orderedAt: new Date(),
      lines: {
        create: [{
          organizationId: ORG, productId, unitOfMeasureId: uomId, lineNumber: 1,
          orderedQuantity: qty, unitPrice: 1, totalPrice: qty,
          productName: "Race Product", productSku: `RACE-${tag}`, unitOfMeasureCode: "PC",
        }],
      },
    },
    include: { lines: true },
  });

  const shipment = await prisma.shipment.create({
    data: {
      organizationId: ORG, shipmentNumber: `SHP-RACE-${tag}`, salesOrderId: so.id,
      warehouseId, status, createdById: ctx.userId,
      lines: {
        create: [{
          organizationId: ORG, salesOrderLineId: so.lines[0].id, productId,
          unitOfMeasureId: uomId, unitOfMeasureCode: "PC",
          quantity: qty, pickedQuantity: picked,
          productName: "Race Product", productSku: `RACE-${tag}`,
        }],
      },
    },
    include: { lines: true },
  });

  return { shipment, salesOrderLineId: so.lines[0].id, lineId: shipment.lines[0].id };
}

describe("LIVE race conditions", () => {
  it("#3a concurrent picks cannot exceed the ordered quantity", async () => {
    const { shipment, lineId } = await makeShipment("PICKING", 10, 0);
    const svc = new ShipmentService();

    // Two warehouse clients each pick the full remaining 10, simultaneously.
    const results = await Promise.allSettled([
      svc.addPickQuantity(ctx, shipment.id, lineId, 10),
      svc.addPickQuantity(ctx, shipment.id, lineId, 10),
    ]);

    const line = await prisma.shipmentLine.findFirstOrThrow({ where: { id: lineId } });
    const picked = Number(line.pickedQuantity);
    const ok = results.filter((r) => r.status === "fulfilled").length;

    console.log(`   [#3a] succeeded=${ok}/2  pickedQuantity=${picked} (ordered 10)`);
    expect(picked).toBeLessThanOrEqual(10);
  });

  it("#3b concurrent un-picks cannot drive the quantity negative", async () => {
    const { shipment, lineId } = await makeShipment("PICKING", 10, 5);
    const svc = new ShipmentService();

    await Promise.allSettled([
      svc.removePickQuantity(ctx, shipment.id, lineId, 5),
      svc.removePickQuantity(ctx, shipment.id, lineId, 5),
    ]);

    const line = await prisma.shipmentLine.findFirstOrThrow({ where: { id: lineId } });
    const picked = Number(line.pickedQuantity);
    console.log(`   [#3b] pickedQuantity=${picked} (must be >= 0)`);
    expect(picked).toBeGreaterThanOrEqual(0);
  });

  it("#3c concurrent deliveries post inventory exactly once", async () => {
    const { shipment, salesOrderLineId } = await makeShipment("LOADED", 4, 4);

    // Stock must exist before it can be shipped. Previously delivery succeeded
    // without this because nothing verified availability; with the negative
    // stock guard in place the fixture has to be realistic.
    await new InventoryPostingService().post({
      organizationId: ORG,
      type: "ADJUSTMENT_IN",
      referenceType: "RACE_TEST_SEED",
      createdById: ctx.userId,
      lines: [{
        productId, unitOfMeasureId: uomId, quantity: 50, toWarehouseId: warehouseId,
        ledgerEntries: [{ warehouseId, movementType: "ADJUSTMENT_IN", direction: "IN", quantity: 50 }],
      }],
    });

    const svc = new ShipmentService();

    await Promise.allSettled([svc.deliver(ctx, shipment.id), svc.deliver(ctx, shipment.id)]);

    const saleTx = await prisma.inventoryTransaction.count({
      where: { organizationId: ORG, referenceType: "SHIPMENT", referenceId: shipment.id },
    });
    const soLine = await prisma.salesOrderLine.findFirstOrThrow({ where: { id: salesOrderLineId } });

    console.log(`   [#3c] SALE transactions=${saleTx} (expect 1)  shippedQuantity=${Number(soLine.shippedQuantity)} (expect 4)`);
    expect(saleTx).toBe(1);
    expect(Number(soLine.shippedQuantity)).toBe(4);
  });

  it("#3d concurrent goods receipts cannot exceed the ordered quantity", async () => {
    // Self-contained fixture: relying on demo data meant this silently skipped
    // once an earlier test consumed the only APPROVED purchase order.
    const tag = Math.random().toString(36).slice(2, 8);
    const supplier = await prisma.supplier.findFirstOrThrow({ where: { organizationId: ORG } });
    const po = await prisma.purchaseOrder.create({
      data: {
        organizationId: ORG, poNumber: `PO-RACE-${tag}`, supplierId: supplier.id,
        status: "APPROVED", currency: "KWD",
        subtotal: 10, taxAmount: 0, totalAmount: 10,
        createdById: ctx.userId, orderedAt: new Date(),
        lines: {
          create: [{
            organizationId: ORG, productId, unitOfMeasureId: uomId, lineNumber: 1,
            orderedQuantity: 10, unitCost: 1, totalCost: 10,
          }],
        },
      },
      include: { lines: true },
    });
    const poLine = po.lines[0];

    const remaining = Number(poLine.orderedQuantity) - Number(poLine.receivedQuantity);
    const svc = new GoodsReceiptService();
    const payload = {
      purchaseOrderId: poLine.purchaseOrderId,
      warehouseId,
      lines: [{ purchaseOrderLineId: poLine.id, productId: poLine.productId, quantity: remaining }],
    } as never;

    await Promise.allSettled([svc.receive(ctx, payload), svc.receive(ctx, payload)]);

    const after = await prisma.purchaseOrderLine.findFirstOrThrow({ where: { id: poLine.id } });
    const received = Number(after.receivedQuantity);
    console.log(`   [#3d] receivedQuantity=${received} (ordered ${Number(after.orderedQuantity)})`);
    expect(received).toBeLessThanOrEqual(Number(after.orderedQuantity));
  });

  it("#2 concurrent payments cannot be lost or overpay the invoice", async () => {
    // The durable invariant: the sum of recorded Payment rows must always equal
    // invoice.amountPaid, and amountPaid must never exceed totalAmount. This
    // replaces a mock-shape assertion with the real rule, proven live.
    const customer = await prisma.customer.findFirstOrThrow({ where: { organizationId: ORG } });
    const tag = Math.random().toString(36).slice(2, 8);

    const so = await prisma.salesOrder.create({
      data: {
        organizationId: ORG, soNumber: `SO-PAY-${tag}`, customerId: customer.id,
        status: "INVOICED", currency: "KWD",
        subtotal: 100, taxAmount: 0, discountAmount: 0, totalAmount: 100,
        createdById: ctx.userId, orderedAt: new Date(),
      },
    });
    const invoice = await prisma.invoice.create({
      data: {
        organizationId: ORG, invoiceNumber: `INV-PAY-${tag}`, salesOrderId: so.id,
        customerId: customer.id, customerName: customer.name, status: "ISSUED", currency: "KWD",
        subtotal: 100, taxAmount: 0, discountAmount: 0, totalAmount: 100,
        amountPaid: 0, issuedAt: new Date(),
      },
    });

    const svc = new PaymentService();
    const pay = () =>
      svc.record(ctx, {
        invoiceId: invoice.id, amount: 50, currency: "KWD", method: "CASH",
      } as never);

    // Two cashiers, same invoice, simultaneously.
    await Promise.allSettled([pay(), pay()]);

    const after = await prisma.invoice.findFirstOrThrow({ where: { id: invoice.id } });
    const recorded = await prisma.payment.aggregate({
      where: { invoiceId: invoice.id }, _sum: { amount: true },
    });

    const amountPaid = Number(after.amountPaid);
    const sumOfPayments = Number(recorded._sum.amount ?? 0);
    console.log(`   [#2] amountPaid=${amountPaid} sumOfPayments=${sumOfPayments} total=100 status=${after.status}`);

    expect(sumOfPayments).toBe(amountPaid);          // no money recorded but unbilled
    expect(amountPaid).toBeLessThanOrEqual(100);     // no overpayment
  });

  it("#4 an OUT movement exceeding on-hand stock is rejected", async () => {
    // assertAvailable() exists but is never called, so nothing stops this.
    const posting = new InventoryPostingService();
    const huge = 999_999;

    const attempt = posting.post({
      organizationId: ORG,
      type: "ADJUSTMENT_OUT",
      referenceType: "RACE_TEST",
      createdById: ctx.userId,
      lines: [{
        productId, unitOfMeasureId: uomId, quantity: huge, fromWarehouseId: warehouseId,
        ledgerEntries: [{ warehouseId, movementType: "ADJUSTMENT_OUT", direction: "OUT", quantity: huge }],
      }],
    });

    await expect(attempt).rejects.toThrow();

    const agg = await prisma.inventoryLedgerEntry.groupBy({
      by: ["direction"], where: { organizationId: ORG, productId, warehouseId }, _sum: { quantity: true },
    });
    const inQty = Number(agg.find((a) => a.direction === "IN")?._sum.quantity ?? 0);
    const outQty = Number(agg.find((a) => a.direction === "OUT")?._sum.quantity ?? 0);
    console.log(`   [#4] derived on-hand = ${inQty - outQty} (must be >= 0)`);
    expect(inQty - outQty).toBeGreaterThanOrEqual(0);
  });
});

/**
 * ROLLBACK GUARANTEES for the transactions introduced by the remediation.
 * A failure partway through must leave no partial effect behind.
 */
describe("transaction rollback", () => {
  it("a failed delivery leaves no ledger entry and no status change", async () => {
    // Quantity deliberately far exceeds anything on hand, so the negative-stock
    // guard aborts the transaction AFTER the status claim has been written
    // inside it. Using a huge number keeps this deterministic regardless of
    // stock accumulated by earlier tests on the shared product.
    const { shipment } = await makeShipment("LOADED", 9_999_999, 9_999_999);
    const svc = new ShipmentService();

    await expect(svc.deliver(ctx, shipment.id)).rejects.toThrow();

    const after = await prisma.shipment.findFirstOrThrow({ where: { id: shipment.id } });
    const saleTx = await prisma.inventoryTransaction.count({
      where: { organizationId: ORG, referenceType: "SHIPMENT", referenceId: shipment.id },
    });

    console.log(`   [rollback] status=${after.status} (expect LOADED)  saleTx=${saleTx} (expect 0)`);
    expect(after.status).toBe("LOADED"); // status claim rolled back with the rest
    expect(saleTx).toBe(0);
  });

  it("a refused payment leaves no Payment row behind", async () => {
    const customer = await prisma.customer.findFirstOrThrow({ where: { organizationId: ORG } });
    const tag = Math.random().toString(36).slice(2, 8);
    const so = await prisma.salesOrder.create({
      data: {
        organizationId: ORG, soNumber: `SO-RB-${tag}`, customerId: customer.id,
        status: "INVOICED", currency: "KWD",
        subtotal: 10, taxAmount: 0, discountAmount: 0, totalAmount: 10,
        createdById: ctx.userId, orderedAt: new Date(),
      },
    });
    const invoice = await prisma.invoice.create({
      data: {
        organizationId: ORG, invoiceNumber: `INV-RB-${tag}`, salesOrderId: so.id,
        customerId: customer.id, customerName: customer.name, status: "ISSUED", currency: "KWD",
        subtotal: 10, taxAmount: 0, discountAmount: 0, totalAmount: 10,
        amountPaid: 9, issuedAt: new Date(),
      },
    });

    // 9 already paid on a 10 invoice; 5 more would overpay and must be refused
    // by the conditional UPDATE inside the transaction.
    await expect(
      new PaymentService().record(ctx, {
        invoiceId: invoice.id, amount: 5, currency: "KWD", method: "CASH",
      } as never),
    ).rejects.toThrow();

    const rows = await prisma.payment.count({ where: { invoiceId: invoice.id } });
    const after = await prisma.invoice.findFirstOrThrow({ where: { id: invoice.id } });

    console.log(`   [rollback] payments=${rows} (expect 0)  amountPaid=${Number(after.amountPaid)} (expect 9)`);
    expect(rows).toBe(0);
    expect(Number(after.amountPaid)).toBe(9);
  });
});
