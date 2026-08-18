-- Database-enforced business invariants.
--
-- Until now every quantity/money rule lived only in application code, so a
-- check-then-write race could persist an impossible state (over-picked lines,
-- negative quantities, invoices paid beyond their total). These constraints
-- make the database the final authority, so any future code path — including
-- one written without knowledge of these rules — cannot commit a violation.
--
-- Verified against the production dataset before authoring: all rows satisfy
-- every constraint below (0 violations across shipment_lines,
-- purchase_order_lines, sales_order_lines, invoices, supplier_invoices).
--
-- Added NOT VALID first, then validated, so the ACCESS EXCLUSIVE lock is held
-- only briefly; VALIDATE takes a weaker SHARE UPDATE EXCLUSIVE lock and does
-- not block reads or writes.

-- ── Picking ────────────────────────────────────────────────────────────────
ALTER TABLE "shipment_lines"
  ADD CONSTRAINT "shipment_lines_picked_within_ordered"
  CHECK ("pickedQuantity" >= 0 AND "pickedQuantity" <= "quantity") NOT VALID;
ALTER TABLE "shipment_lines" VALIDATE CONSTRAINT "shipment_lines_picked_within_ordered";

-- ── Receiving ──────────────────────────────────────────────────────────────
ALTER TABLE "purchase_order_lines"
  ADD CONSTRAINT "po_lines_received_within_ordered"
  CHECK ("receivedQuantity" >= 0 AND "receivedQuantity" <= "orderedQuantity") NOT VALID;
ALTER TABLE "purchase_order_lines" VALIDATE CONSTRAINT "po_lines_received_within_ordered";

-- ── Sales order fulfilment ─────────────────────────────────────────────────
-- shippedQuantity is intentionally NOT capped at orderedQuantity: over-shipment
-- is a business decision that may be legitimate. Only nonsensical values are
-- rejected, plus the rule that you cannot return more than was shipped.
ALTER TABLE "sales_order_lines"
  ADD CONSTRAINT "so_lines_quantities_non_negative"
  CHECK ("shippedQuantity" >= 0 AND "returnedQuantity" >= 0) NOT VALID;
ALTER TABLE "sales_order_lines" VALIDATE CONSTRAINT "so_lines_quantities_non_negative";

ALTER TABLE "sales_order_lines"
  ADD CONSTRAINT "so_lines_returned_within_shipped"
  CHECK ("returnedQuantity" <= "shippedQuantity") NOT VALID;
ALTER TABLE "sales_order_lines" VALIDATE CONSTRAINT "so_lines_returned_within_shipped";

-- ── Money: accounts receivable ─────────────────────────────────────────────
ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_amount_paid_within_total"
  CHECK ("amountPaid" >= 0 AND "amountPaid" <= "totalAmount") NOT VALID;
ALTER TABLE "invoices" VALIDATE CONSTRAINT "invoices_amount_paid_within_total";

-- ── Money: accounts payable ────────────────────────────────────────────────
ALTER TABLE "supplier_invoices"
  ADD CONSTRAINT "supplier_invoices_amount_paid_within_total"
  CHECK ("amountPaid" >= 0 AND "amountPaid" <= "totalAmount") NOT VALID;
ALTER TABLE "supplier_invoices" VALIDATE CONSTRAINT "supplier_invoices_amount_paid_within_total";
