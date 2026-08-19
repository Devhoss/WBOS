-- Proof of delivery: many ordered documents per delivery.
--
-- Signed delivery paperwork is photographed page by page with the phone's
-- camera, so one delivery produces several images. The existing single
-- `sales_orders.signedInvoicePath` cannot express page 2. Rather than a second
-- document store, proof of delivery becomes an `attachments` row against the
-- shipment, which already carries organization scoping, soft delete, and the
-- ownership check on /api/uploads.
--
-- `sales_orders.signedInvoicePath` is deliberately left in place: existing rows
-- point at real files and are still served. Nothing here reads or rewrites it.

ALTER TYPE "AttachmentType" ADD VALUE IF NOT EXISTS 'PROOF_OF_DELIVERY';

ALTER TABLE "attachments"
  ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "contentHash" TEXT;

CREATE INDEX IF NOT EXISTS "attachments_organizationId_entityType_entityId_sortOrder_idx"
  ON "attachments" ("organizationId", "entityType", "entityId", "sortOrder");

-- Idempotent upload. A retry after a timeout re-sends identical bytes; without
-- this the delivery grows a duplicate page each time the signal drops. Scoped
-- to live rows so that removing a page and photographing it again is allowed,
-- which a plain UNIQUE constraint would forbid forever.
CREATE UNIQUE INDEX IF NOT EXISTS "attachments_live_content_unique"
  ON "attachments" ("organizationId", "entityType", "entityId", "contentHash")
  WHERE "archivedAt" IS NULL AND "contentHash" IS NOT NULL;
