# Phase 3 Inventory Architecture Proposal

> Status: Draft for review
>
> Scope: Quantity movement engine only. Inventory valuation, FIFO costing, lots, batches, and serial numbers are designed for but not implemented in Phase 3.

---

# Core Decision

Inventory is a separate domain from Products.

Products remain catalog/master data only. Products must never store current stock, on-hand quantity, reserved quantity, inventory cost, average cost, warehouse assignment, or valuation state.

The inventory ledger is the source of truth. Every stock change is represented as an immutable inventory transaction with one or more ledger entries. Current stock is derived from ledger entries.

---

# Domain Boundaries

## Products Domain

Owns product identity and catalog information:

* SKU
* Barcode
* Name
* Category
* Unit of measure
* Supplier preference
* Default selling price
* Product lifecycle status

Products do not know where stock exists or how much stock exists.

## Warehouses Domain

Owns physical storage locations:

* Warehouse identity
* Warehouse code
* Address
* Default warehouse flag
* Warehouse lifecycle

Warehouses do not own stock balances directly. Warehouses are dimensions on inventory ledger entries.

## Inventory Domain

Owns stock movement history:

* Inventory transactions
* Inventory transaction lines
* Inventory ledger entries
* Adjustment reasons
* Stock balance calculations
* Stock availability validation
* Movement history

The Inventory domain references Products and Warehouses, but Products and Warehouses do not own inventory state.

---

# Proposed Prisma Models

This section describes intended models only. Do not implement until this proposal is reviewed.

## InventoryTransaction

Represents one business operation that affects inventory.

Examples:

* Opening balance
* Manual receipt
* Sale
* Transfer
* Adjustment
* Customer return
* Supplier return

Recommended fields:

* `id`
* `organizationId`
* `type`
* `status`
* `referenceType`
* `referenceId`
* `occurredAt`
* `postedAt`
* `createdById`
* `notes`
* `createdAt`

Why it exists:

Inventory operations are business events. A transfer, receipt, or adjustment should be visible as one operation even if it creates multiple ledger entries internally.

Recommended constraints and indexes:

* Index `organizationId, occurredAt`
* Index `organizationId, type`
* Index `organizationId, referenceType, referenceId`

## InventoryTransactionLine

Represents one product line inside an inventory transaction.

Recommended fields:

* `id`
* `organizationId`
* `transactionId`
* `productId`
* `unitOfMeasureId`
* `quantity`
* `fromWarehouseId`
* `toWarehouseId`
* `adjustmentReasonId`
* `notes`
* `createdAt`

Why it exists:

Many operations involve multiple products. Lines preserve the user-facing business intent before translating that intent into ledger entries.

Example:

A manual receipt with 12 products should be one `InventoryTransaction` with 12 `InventoryTransactionLine` records.

## InventoryLedgerEntry

Represents the immutable stock movement record.

Recommended fields:

* `id`
* `organizationId`
* `transactionId`
* `transactionLineId`
* `productId`
* `warehouseId`
* `movementType`
* `quantity`
* `direction`
* `occurredAt`
* `createdAt`

Why it exists:

This is the source of truth for stock. Current stock is calculated by summing ledger entries, not by editing a stored quantity.

Recommended rule:

Ledger entries are append-only. They are never edited or deleted. Mistakes are corrected with new transactions.

Recommended constraints and indexes:

* Index `organizationId, productId, warehouseId`
* Index `organizationId, warehouseId`
* Index `organizationId, productId`
* Index `organizationId, occurredAt`
* Index `transactionId`
* Index `transactionLineId`

## AdjustmentReason

Represents a controlled reason code for inventory adjustments.

Recommended fields:

* `id`
* `organizationId`
* `name`
* `code`
* `direction`
* `isSystem`
* `archivedAt`
* `createdAt`
* `updatedAt`

Initial reason codes:

* Opening Balance
* Damage
* Lost
* Expired
* Count Correction
* Manual Correction

Why it exists:

Adjustments must be auditable. A plain notes field is not enough for reporting or accountability.

## InventoryMovementType

Recommended as a Prisma enum.

Initial values:

* `OPENING_BALANCE`
* `MANUAL_RECEIPT`
* `PURCHASE_RECEIPT`
* `SALE`
* `TRANSFER_OUT`
* `TRANSFER_IN`
* `ADJUSTMENT_IN`
* `ADJUSTMENT_OUT`
* `CUSTOMER_RETURN`
* `SUPPLIER_RETURN`
* `DAMAGE`
* `EXPIRED`

Why it exists:

Movement type makes ledger entries understandable and reportable without relying only on transaction metadata.

## InventoryDirection

Recommended as a Prisma enum.

Values:

* `IN`
* `OUT`

Why it exists:

The balance formula stays simple:

`current stock = SUM(IN quantities) - SUM(OUT quantities)`

Quantities should remain positive. Direction determines whether the movement increases or decreases stock.

## InventoryTransactionStatus

Recommended as a Prisma enum.

Initial values:

* `DRAFT`
* `POSTED`
* `VOIDED`

Phase 3 should strongly prefer posting transactions immediately. Draft support may be useful for future larger workflows, but ledger entries should only exist for posted transactions.

---

# Relationships

Recommended relationship shape:

```text
Organization
  └── InventoryTransaction
        └── InventoryTransactionLine
              └── InventoryLedgerEntry

Product
  └── InventoryTransactionLine
  └── InventoryLedgerEntry

Warehouse
  └── InventoryLedgerEntry

AdjustmentReason
  └── InventoryTransactionLine
```

Every inventory model must include `organizationId`.

Every repository query must scope by `organizationId`.

---

# Transaction Flow

All stock-affecting workflows should use the same internal posting pattern:

1. Validate authenticated request context.
2. Enforce RBAC.
3. Validate input with Zod.
4. Load referenced products, warehouses, units, and reason codes within the organization.
5. Validate business rules.
6. Create `InventoryTransaction`.
7. Create `InventoryTransactionLine` records.
8. Create immutable `InventoryLedgerEntry` records.
9. Create activity log.
10. Revalidate inventory pages.

These database writes should happen in one Prisma transaction.

Nothing should directly update a product, warehouse, or stored stock quantity to represent inventory movement.

---

# Ledger Rules

Ledger entries must be immutable.

Allowed:

* Create a new ledger entry.
* Create a correcting transaction.
* Void a transaction by creating reversal entries or marking the parent transaction voided with a controlled reversal flow.

Not allowed:

* Editing ledger quantity.
* Deleting ledger entries.
* Updating product stock fields.
* Updating warehouse stock fields.

Phase 3 should start with posted immutable transactions and defer void/reversal workflows unless needed immediately.

---

# Stock Balance Calculation

The balance service is the only source used by UI and workflows when displaying or validating inventory balances.

Recommended service:

`StockBalanceService`

Responsibilities:

* Get stock by product.
* Get stock by warehouse.
* Get stock by product and warehouse.
* Get low-stock candidates.
* Validate available stock before outbound movements.
* Provide movement history summaries.

Base formula:

```text
Current Stock =
  SUM(quantity where direction = IN)
  -
  SUM(quantity where direction = OUT)
```

Recommended repository:

`InventoryLedgerRepository`

Responsibilities:

* Aggregate balances from ledger entries.
* Query movement history.
* Query stock card entries.
* Query warehouse/product balances.

Phase 3 should calculate balances directly from ledger entries. A derived `InventoryBalanceSnapshot` table may be introduced later for performance, but it must be treated as a cache, not source of truth.

---

# Service Responsibilities

## InventoryTransactionService

Coordinates inventory operations:

* Manual receipt
* Inventory adjustment
* Warehouse transfer
* Future purchase receipt
* Future sale issue
* Future returns

It should own posting workflow orchestration.

## InventoryPostingService

Converts validated transaction lines into ledger entries.

Examples:

Manual receipt:

* One line creates one `IN` ledger entry.

Adjustment increase:

* One line creates one `IN` ledger entry.

Adjustment decrease:

* One line creates one `OUT` ledger entry after available-stock validation.

Transfer:

* One line creates one `OUT` ledger entry from source warehouse.
* One line creates one `IN` ledger entry to destination warehouse.

## StockBalanceService

Calculates balances and availability from ledger entries.

Other modules should not query ledger aggregates directly.

## AdjustmentReasonService

Manages reason codes and validates whether a reason can be used for a given adjustment direction.

---

# Repository Responsibilities

## InventoryTransactionRepository

* Create transactions.
* Create transaction lines.
* Find transactions by ID.
* Query transaction history.

## InventoryLedgerRepository

* Create ledger entries.
* Aggregate balances.
* Query product stock cards.
* Query movement history.

## AdjustmentReasonRepository

* List active reason codes.
* Create/update/archive reason codes.
* Find reason code by ID and organization.

Repositories should not contain business rules beyond organization scoping and query shape.

---

# Warehouse Interaction

Warehouses participate in inventory as movement dimensions.

Rules:

* Inbound movement requires a destination warehouse.
* Outbound movement requires a source warehouse.
* Transfer requires both source and destination warehouses.
* Source and destination warehouse cannot be the same.
* Archived warehouses cannot be used for new inventory transactions.
* Historical ledger entries remain valid if a warehouse is archived later.

Warehouse stock is derived by filtering ledger entries by `warehouseId`.

---

# Step 5: Manual Inventory Receiving

Purpose:

Allow stock to be added before purchase orders exist.

Workflow:

1. User opens Manual Receiving.
2. User selects warehouse.
3. User selects one or more active products.
4. User enters positive quantities.
5. User optionally adds notes.
6. Server validates products and warehouse.
7. Server creates one posted `InventoryTransaction` of type `MANUAL_RECEIPT`.
8. Server creates transaction lines.
9. Server creates `IN` ledger entries.
10. Server writes activity log.

Business rules:

* Quantity must be greater than zero.
* Product must be active.
* Warehouse must be active.
* Manual receipts require warehouse or manager permission.

---

# Step 6: Inventory Adjustments

Purpose:

Correct inventory without editing stock directly.

Workflow:

1. User selects product.
2. User selects warehouse.
3. User selects adjustment direction or reason.
4. User enters quantity.
5. User enters notes when required.
6. Server validates current available stock for decreases.
7. Server creates posted adjustment transaction.
8. Server creates one ledger entry per line.

Reason codes:

* Opening Balance
* Damage
* Lost
* Expired
* Count Correction
* Manual Correction

Business rules:

* Adjustment reason is required.
* Decrease cannot make stock negative unless future settings explicitly allow negative inventory.
* Adjustment must create activity log.
* Ledger entry must remain immutable.

---

# Step 7: Warehouse Transfers

Purpose:

Move stock between warehouses as one business operation.

Workflow:

1. User selects source warehouse.
2. User selects destination warehouse.
3. User selects one or more products and quantities.
4. Server validates available stock in source warehouse.
5. Server creates one `InventoryTransaction` of type `WAREHOUSE_TRANSFER`.
6. For each line, server creates:
   * `TRANSFER_OUT` ledger entry in source warehouse.
   * `TRANSFER_IN` ledger entry in destination warehouse.
7. Server writes one activity log for the transfer.

Business rules:

* Source and destination warehouse must differ.
* Both warehouses must be active.
* Quantity must be positive.
* Source warehouse must have enough available stock.
* Transfer should be atomic.

---

# Step 8: Inventory Views

## Stock by Product

Shows total stock across all warehouses grouped by product.

Data source:

`StockBalanceService.getStockByProduct()`

## Stock by Warehouse

Shows products and quantities within a selected warehouse.

Data source:

`StockBalanceService.getStockByWarehouse()`

## Low Stock

Shows products below configured thresholds.

Phase 3 can display this only if thresholds exist later. Until then, keep the page architecture ready but avoid inventing product stock fields.

Future threshold options:

* Product-level reorder point
* Product/warehouse reorder point
* Organization default threshold

## Movement History

Shows inventory transactions by date, type, product, warehouse, and user.

Data source:

`InventoryTransactionService` plus ledger details.

## Product Stock Card

Shows chronological ledger entries for one product.

Columns:

* Date
* Movement type
* Warehouse
* Reference
* In
* Out
* Running balance
* User

Running balance should be calculated for display from ledger order.

## Costing

Do not implement costing in Phase 3.

The data model should avoid blocking future costing by keeping transaction lines and ledger entries linked cleanly to product and warehouse dimensions.

---

# Future Module Integration

## Purchase Orders and GRN

Future purchase receiving should call the inventory posting service.

Purchase receipt flow:

```text
Goods Receipt
  -> InventoryTransaction(type = PURCHASE_RECEIPT, reference = GRN)
  -> InventoryTransactionLine
  -> InventoryLedgerEntry(direction = IN)
```

Purchase Orders do not create inventory. Goods receipt creates inventory.

## Sales Invoices

Finalized invoices should create outbound inventory movements.

Sales flow:

```text
Invoice Finalized
  -> InventoryTransaction(type = SALE, reference = Invoice)
  -> InventoryTransactionLine
  -> InventoryLedgerEntry(direction = OUT)
```

Draft invoices should not affect inventory.

## Returns

Customer returns create inbound inventory movements.

Supplier returns create outbound inventory movements.

Both should reference their source documents.

## Lot and Batch Tracking

Future lot support can be added by linking ledger entries to `InventoryLot`.

Phase 3 should avoid putting lot-specific assumptions into the base ledger. The ledger can support optional future fields:

* `lotId`
* `batchNumber`
* `expiryDate`
* `serialNumberId`

These should not be implemented until the related workflows are ready.

## Inventory Valuation

Future valuation can consume ledger entries and lots.

Potential models later:

* `InventoryLot`
* `InventoryCostLayer`
* `InventoryValuationEntry`

Phase 3 must not store product cost, average cost, or valuation directly on Product.

---

# RBAC

Recommended initial permissions:

* Managers can perform all inventory operations.
* Warehouse users can receive, adjust, transfer, and view inventory if allowed.
* Sales users can view inventory availability.
* Viewers can view inventory only.

Authorization must be enforced in server actions.

Business rules still apply regardless of role.

---

# Activity Logging

Required activity events:

* `INVENTORY_RECEIVED`
* `INVENTORY_ADJUSTED`
* `INVENTORY_TRANSFERRED`
* `INVENTORY_TRANSACTION_POSTED`

Activity metadata should include:

* Transaction ID
* Transaction type
* Product IDs
* Warehouse IDs
* Quantities
* Reason code when applicable
* Reference document when applicable

---

# Validation

All server actions should validate input with Zod.

Common rules:

* Product IDs are required.
* Warehouse IDs are required based on movement direction.
* Quantities must be positive.
* Archived products cannot be used for new movements.
* Archived warehouses cannot be used for new movements.
* Adjustment reason is required for adjustments.
* Outbound movements cannot exceed available stock unless future settings allow negative inventory.

---

# Recommended Phase 3 Implementation Order

1. Add inventory architecture documentation.
2. Add Prisma enums and models.
3. Add repositories.
4. Add stock balance service.
5. Add transaction posting service.
6. Add manual receiving workflow.
7. Add adjustment reasons and adjustment workflow.
8. Add warehouse transfer workflow.
9. Add inventory views.
10. Add tests for balance calculations and posting rules.

---

# Open Questions

These should be decided before implementation:

1. Should Phase 3 support draft inventory transactions, or only posted transactions?
2. Should negative inventory be globally forbidden in Phase 3?
3. Should opening balance be modeled as an adjustment reason, a movement type, or both?
4. Should manual receiving require notes?
5. Should low-stock thresholds be deferred until after quantity ledger is working?

Recommended answers:

1. Start with posted transactions only.
2. Forbid negative inventory.
3. Use both `OPENING_BALANCE` movement type and an Opening Balance reason code for adjustment-style setup.
4. Require notes for manual corrections and decreases, optional for receipts.
5. Defer thresholds until after core stock balances are proven.

---

# Final Principle

Inventory state is not something WBOS edits.

Inventory state is something WBOS proves from history.

The ledger is the history. The balance is the result.
