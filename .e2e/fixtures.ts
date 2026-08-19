import { prisma } from "@/infrastructure/database/prisma";

/**
 * Fixture tracking and teardown for the end-to-end suites.
 *
 * These suites run against a real, persistent PostgreSQL — that is the point of
 * them — so anything they create and abandon stays. Four suites had no
 * `afterAll` at all, and by the time it was noticed they had left 80 ISSUED
 * invoices behind, which the revenue and gross-profit reports were counting.
 *
 * Two properties matter more than tidiness:
 *
 *   - `valuation-sync-e2e` asserts an absolute organisation-wide inventory
 *     value. A suite that leaves stock behind makes that assertion fail in its
 *     `beforeAll`, and a failed `beforeAll` SKIPS the suite — which still reads
 *     as green in the summary line. Leaked value turns into silently missing
 *     coverage somewhere else.
 *   - Deletion order is not obvious. Most of these relations are
 *     `onDelete: Restrict`, so children must go first, and the ledger has to be
 *     unwound before the products it references. Every suite reimplementing
 *     that order is how one of them ends up subtly wrong.
 *
 * So the order lives here once. A suite records what it made and calls
 * `cleanup()`; nothing depends on execution order, and each suite removes only
 * its own rows.
 */

export type FixtureTracker = {
  product: (id: string) => string;
  warehouse: (id: string) => string;
  customer: (id: string) => string;
  salesOrder: (id: string) => string;
  invoice: (id: string) => string;
  shipment: (id: string) => string;
  returnOrder: (id: string) => string;
  purchaseOrder: (id: string) => string;
  task: (id: string) => string;
  /** Delete everything recorded, children first. Safe to call more than once. */
  cleanup: () => Promise<void>;
};

export function createFixtureTracker(): FixtureTracker {
  const productIds: string[] = [];
  const warehouseIds: string[] = [];
  const customerIds: string[] = [];
  const salesOrderIds: string[] = [];
  const invoiceIds: string[] = [];
  const shipmentIds: string[] = [];
  const returnOrderIds: string[] = [];
  const purchaseOrderIds: string[] = [];
  const taskIds: string[] = [];

  /** Record and return, so a tracker call can wrap the id inline. */
  const push = (into: string[]) => (id: string) => {
    if (id && !into.includes(id)) into.push(id);
    return id;
  };

  async function cleanup(): Promise<void> {
    // Invoices reached through their sales orders as well as directly: a suite
    // usually tracks the order and lets the service create the invoice.
    const invoiceIdSet = new Set(invoiceIds);
    if (salesOrderIds.length > 0) {
      const owned = await prisma.invoice.findMany({
        where: { salesOrderId: { in: salesOrderIds } },
        select: { id: true },
      });
      for (const i of owned) invoiceIdSet.add(i.id);
    }
    const allInvoiceIds = [...invoiceIdSet];

    // Same for shipments and tasks, which services create on the suite's behalf.
    const shipmentIdSet = new Set(shipmentIds);
    if (salesOrderIds.length > 0) {
      const owned = await prisma.shipment.findMany({
        where: { salesOrderId: { in: salesOrderIds } },
        select: { id: true },
      });
      for (const s of owned) shipmentIdSet.add(s.id);
    }
    const allShipmentIds = [...shipmentIdSet];

    const taskIdSet = new Set(taskIds);
    if (salesOrderIds.length > 0) {
      const owned = await prisma.task.findMany({
        where: { referenceType: "SALES_ORDER", referenceId: { in: salesOrderIds } },
        select: { id: true },
      });
      for (const t of owned) taskIdSet.add(t.id);
    }
    const allTaskIds = [...taskIdSet];

    // ── Credit notes ──────────────────────────────────────────────────────
    if (allInvoiceIds.length > 0) {
      const notes = await prisma.creditNote.findMany({
        where: { invoiceId: { in: allInvoiceIds } },
        select: { id: true },
      });
      const noteIds = notes.map((n) => n.id);
      if (noteIds.length > 0) {
        await prisma.creditNoteLine.deleteMany({ where: { creditNoteId: { in: noteIds } } });
        await prisma.creditNote.deleteMany({ where: { id: { in: noteIds } } });
      }
    }

    // ── Returns ───────────────────────────────────────────────────────────
    if (returnOrderIds.length > 0) {
      await prisma.returnOrderLine.deleteMany({ where: { returnOrderId: { in: returnOrderIds } } });
      await prisma.returnOrder.deleteMany({ where: { id: { in: returnOrderIds } } });
    }

    // ── Picking and tasks ─────────────────────────────────────────────────
    if (allTaskIds.length > 0) {
      await prisma.pickingAction.deleteMany({ where: { taskId: { in: allTaskIds } } });
      await prisma.taskLine.deleteMany({ where: { taskId: { in: allTaskIds } } });
      await prisma.task.deleteMany({ where: { id: { in: allTaskIds } } });
    }

    // ── Inventory: unwind before the products it references ───────────────
    if (productIds.length > 0) {
      const where = { productId: { in: productIds } };
      const txIds = (
        await prisma.inventoryTransactionLine.findMany({ where, select: { transactionId: true } })
      ).map((l) => l.transactionId);

      await prisma.inventoryLedgerEntry.deleteMany({ where });
      await prisma.inventoryTransactionLine.deleteMany({ where });
      if (txIds.length > 0) {
        await prisma.inventoryTransaction.deleteMany({ where: { id: { in: txIds } } });
      }
      await prisma.productCost.deleteMany({ where });
    }

    // ── Sales documents ───────────────────────────────────────────────────
    if (allShipmentIds.length > 0) {
      await prisma.shipmentLine.deleteMany({ where: { shipmentId: { in: allShipmentIds } } });
      await prisma.shipment.deleteMany({ where: { id: { in: allShipmentIds } } });
    }
    if (allInvoiceIds.length > 0) {
      await prisma.payment.deleteMany({ where: { invoiceId: { in: allInvoiceIds } } });
      await prisma.invoiceLine.deleteMany({ where: { invoiceId: { in: allInvoiceIds } } });
      await prisma.invoice.deleteMany({ where: { id: { in: allInvoiceIds } } });
    }
    if (salesOrderIds.length > 0) {
      await prisma.salesOrderLine.deleteMany({ where: { salesOrderId: { in: salesOrderIds } } });
      await prisma.salesOrder.deleteMany({ where: { id: { in: salesOrderIds } } });
    }

    // ── Purchasing ────────────────────────────────────────────────────────
    if (purchaseOrderIds.length > 0) {
      await prisma.purchaseOrderLine.deleteMany({
        where: { purchaseOrderId: { in: purchaseOrderIds } },
      });
      await prisma.purchaseOrder.deleteMany({ where: { id: { in: purchaseOrderIds } } });
    }

    // ── Masters last ──────────────────────────────────────────────────────
    if (productIds.length > 0) {
      await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    }
    if (warehouseIds.length > 0) {
      await prisma.warehouse.deleteMany({ where: { id: { in: warehouseIds } } });
    }
    if (customerIds.length > 0) {
      await prisma.customer.deleteMany({ where: { id: { in: customerIds } } });
    }

    productIds.length = 0;
    warehouseIds.length = 0;
    customerIds.length = 0;
    salesOrderIds.length = 0;
    invoiceIds.length = 0;
    shipmentIds.length = 0;
    returnOrderIds.length = 0;
    purchaseOrderIds.length = 0;
    taskIds.length = 0;
  }

  return {
    product: push(productIds),
    warehouse: push(warehouseIds),
    customer: push(customerIds),
    salesOrder: push(salesOrderIds),
    invoice: push(invoiceIds),
    shipment: push(shipmentIds),
    returnOrder: push(returnOrderIds),
    purchaseOrder: push(purchaseOrderIds),
    task: push(taskIds),
    cleanup,
  };
}
