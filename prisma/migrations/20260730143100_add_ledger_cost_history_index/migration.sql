-- Add composite index for cost history / cost card queries
-- Queries always filter by (organizationId, productId, warehouseId, occurredAt)
CREATE INDEX "idx_ledger_org_product_warehouse_occurred" ON "inventory_ledger_entries"("organizationId", "productId", "warehouseId", "occurredAt");
