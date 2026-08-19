/**
 * The database invariants worth asserting before a deployment and after a
 * migration.
 *
 * Kept as data so `integrity-diagnostics.mjs` stays a thin runner and so the
 * catalogue itself can be tested. Every check is a COUNT of violating rows:
 * zero is healthy, anything else is the number of rows that break the rule.
 *
 * `severity` separates "this is wrong" from "this is worth knowing". A
 * `violation` fails the run; an `advisory` is reported and does not. The
 * one-fils invoice rounding gap is the motivating advisory — an invoice total
 * derived from an unrounded discount is a real inconsistency, but it is not
 * corruption and should not block a deployment.
 *
 * Plain ESM rather than TypeScript so the script runs with bare `node`, with no
 * build step and no loader, which is what makes it usable from a deploy script.
 */

/** @typedef {"violation" | "advisory"} CheckSeverity */
/** @typedef {{ id: string, name: string, severity: CheckSeverity, sql: string }} IntegrityCheck */

/** @type {readonly IntegrityCheck[]} */
export const INTEGRITY_CHECKS = [
  // ── Quantities ───────────────────────────────────────────────────────────
  {
    id: "picked-within-ordered",
    name: "shipment lines never over-picked",
    severity: "violation",
    sql: `SELECT count(*)::int AS n FROM "shipment_lines"
          WHERE "pickedQuantity" < 0 OR "pickedQuantity" > "quantity"`,
  },
  {
    id: "received-within-ordered",
    name: "purchase order lines never over-received",
    severity: "violation",
    sql: `SELECT count(*)::int AS n FROM "purchase_order_lines"
          WHERE "receivedQuantity" < 0 OR "receivedQuantity" > "orderedQuantity"`,
  },
  {
    id: "so-quantities-non-negative",
    name: "sales order line quantities are non-negative",
    severity: "violation",
    sql: `SELECT count(*)::int AS n FROM "sales_order_lines"
          WHERE "shippedQuantity" < 0 OR "returnedQuantity" < 0`,
  },
  {
    id: "returned-within-shipped",
    name: "nothing is returned that was never shipped",
    severity: "violation",
    sql: `SELECT count(*)::int AS n FROM "sales_order_lines"
          WHERE "returnedQuantity" > "shippedQuantity"`,
  },

  // ── Money ────────────────────────────────────────────────────────────────
  {
    id: "ar-paid-within-total",
    name: "no invoice is paid beyond its total",
    severity: "violation",
    sql: `SELECT count(*)::int AS n FROM "invoices"
          WHERE "amountPaid" < 0 OR "amountPaid" > "totalAmount"`,
  },
  {
    id: "ap-paid-within-total",
    name: "no supplier invoice is paid beyond its total",
    severity: "violation",
    sql: `SELECT count(*)::int AS n FROM "supplier_invoices"
          WHERE "amountPaid" < 0 OR "amountPaid" > "totalAmount"`,
  },
  {
    id: "ar-credited-within-total",
    name: "no invoice is credited beyond its total",
    severity: "violation",
    sql: `SELECT count(*)::int AS n FROM "invoices"
          WHERE "creditedAmount" < 0 OR "creditedAmount" > "totalAmount"`,
  },
  {
    id: "invoice-header-matches-lines",
    name: "each invoice subtotal equals the sum of its lines",
    severity: "violation",
    sql: `SELECT count(*)::int AS n FROM (
            SELECT i.id FROM "invoices" i
            JOIN "invoice_lines" l ON l."invoiceId" = i.id
            GROUP BY i.id, i."subtotal"
            HAVING ROUND(SUM(l."totalPrice"), 3) <> ROUND(i."subtotal", 3)
          ) x`,
  },
  {
    id: "payments-within-invoice-total",
    name: "recorded payments never exceed the invoice they settle",
    severity: "violation",
    sql: `SELECT count(*)::int AS n FROM (
            SELECT i.id FROM "invoices" i
            JOIN "payments" p ON p."invoiceId" = i.id
            GROUP BY i.id, i."totalAmount"
            HAVING ROUND(SUM(p."amount"), 3) > ROUND(i."totalAmount", 3)
          ) x`,
  },
  {
    id: "invoice-total-materially-correct",
    name: "no invoice total is off by more than one fils",
    severity: "violation",
    sql: `SELECT count(*)::int AS n FROM "invoices"
          WHERE ABS(("subtotal" + "taxAmount" - "discountAmount") - "totalAmount") > 0.001`,
  },
  {
    id: "invoice-total-exact",
    name: "invoice totals reconcile exactly to their stored components",
    severity: "advisory",
    sql: `SELECT count(*)::int AS n FROM "invoices"
          WHERE ROUND("subtotal" + "taxAmount" - "discountAmount", 3) <> ROUND("totalAmount", 3)`,
  },

  // ── Inventory ────────────────────────────────────────────────────────────
  {
    id: "no-negative-stock",
    name: "no product/warehouse holds negative stock",
    severity: "violation",
    sql: `SELECT count(*)::int AS n FROM (
            SELECT e."productId", e."warehouseId"
            FROM "inventory_ledger_entries" e
            GROUP BY e."productId", e."warehouseId"
            HAVING SUM(CASE WHEN e."direction" = 'IN' THEN e."quantity" ELSE -e."quantity" END) < 0
          ) x`,
  },
  {
    id: "no-negative-costed-quantity",
    name: "no costed quantity is negative",
    severity: "violation",
    sql: `SELECT count(*)::int AS n FROM "product_costs" WHERE "totalQuantity" < 0`,
  },
  {
    id: "average-cost-consistent",
    name: "average cost agrees with value divided by quantity",
    severity: "violation",
    sql: `SELECT count(*)::int AS n FROM "product_costs"
          WHERE "totalQuantity" > 0
            AND ABS("averageCost" - ("totalValue" / "totalQuantity")) > 0.001`,
  },
  {
    id: "ledger-has-transaction",
    name: "every ledger entry belongs to a transaction",
    severity: "violation",
    sql: `SELECT count(*)::int AS n FROM "inventory_ledger_entries" e
          LEFT JOIN "inventory_transactions" t ON t.id = e."transactionId"
          WHERE t.id IS NULL`,
  },
  {
    id: "ledger-quantity-non-zero",
    name: "no ledger entry moves zero quantity",
    severity: "violation",
    sql: `SELECT count(*)::int AS n FROM "inventory_ledger_entries" WHERE "quantity" = 0`,
  },

  // ── Referential integrity and tenancy ────────────────────────────────────
  {
    id: "invoice-sales-order-exists",
    name: "every invoice points at a sales order that exists",
    severity: "violation",
    sql: `SELECT count(*)::int AS n FROM "invoices" i
          LEFT JOIN "sales_orders" o ON o.id = i."salesOrderId"
          WHERE i."salesOrderId" IS NOT NULL AND o.id IS NULL`,
  },
  {
    id: "invoice-lines-same-org",
    name: "invoice lines share their invoice's organization",
    severity: "violation",
    sql: `SELECT count(*)::int AS n FROM "invoice_lines" l
          JOIN "invoices" i ON i.id = l."invoiceId"
          WHERE l."organizationId" <> i."organizationId"`,
  },
  {
    id: "shipment-lines-same-org",
    name: "shipment lines share their shipment's organization",
    severity: "violation",
    sql: `SELECT count(*)::int AS n FROM "shipment_lines" sl
          JOIN "shipments" s ON s.id = sl."shipmentId"
          WHERE sl."organizationId" <> s."organizationId"`,
  },
  {
    id: "no-orphan-task-lines",
    name: "no task line outlives its task",
    severity: "violation",
    sql: `SELECT count(*)::int AS n FROM "task_lines" tl
          LEFT JOIN "tasks" t ON t.id = tl."taskId"
          WHERE t.id IS NULL`,
  },

  // ── Test residue ─────────────────────────────────────────────────────────
  {
    id: "no-test-fixture-documents",
    name: "every document number came from the real sequence",
    // Detected by shape rather than by a list of prefixes: DocumentNumberService
    // always produces `SO-YYYY-NNNNNN` / `INV-YYYY-NNNNNN`, so anything else was
    // hand-built by a test. Prefix lists go stale the moment a suite invents a
    // new one; the shape does not.
    //
    // Advisory, because finding fixtures on a development database while a suite
    // is mid-run is expected. On a deployment target it should be zero.
    severity: "advisory",
    sql: `SELECT (
            (SELECT count(*)::int FROM "sales_orders" WHERE "soNumber" !~ '^SO-[0-9]{4}-[0-9]+$')
          + (SELECT count(*)::int FROM "invoices"     WHERE "invoiceNumber" !~ '^INV-[0-9]{4}-[0-9]+$')
          )::int AS n`,
  },
];
