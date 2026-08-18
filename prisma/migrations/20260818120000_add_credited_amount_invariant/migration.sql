-- Database-enforced ceiling on how much of an invoice can be credited.
--
-- `Invoice.creditedAmount` was maintained by re-aggregating every ISSUED credit
-- note and writing the result with an unconditional UPDATE. Nothing capped the
-- result at the invoice total, so an invoice could be credited far beyond what
-- it was worth: ten concurrent credits of 30 against a 100 invoice produced a
-- creditedAmount of 300.
--
-- The application now claims the increase with a conditional UPDATE, but this
-- constraint is what binds any future code path written without knowledge of
-- the rule -- the same role the amountPaid constraints already play.
--
-- Verified against the production dataset before authoring: 15 invoices, zero
-- credit notes, every creditedAmount 0. No existing row violates this.
--
-- Added NOT VALID first, then validated, so the ACCESS EXCLUSIVE lock is held
-- only briefly; VALIDATE takes a weaker SHARE UPDATE EXCLUSIVE lock and does
-- not block reads or writes.

ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_credited_amount_within_total"
  CHECK ("creditedAmount" >= 0 AND "creditedAmount" <= "totalAmount") NOT VALID;
ALTER TABLE "invoices" VALIDATE CONSTRAINT "invoices_credited_amount_within_total";
