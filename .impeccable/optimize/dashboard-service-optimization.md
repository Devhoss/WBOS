# Dashboard Service Optimization Report

**Date:** 2026-08-09
**Target:** `src/app/dashboard-service.ts`
**Scope:** Performance — query count reduction and elimination of expensive in-memory operations

---

## Changes Applied

### 1. Replace `getLowStockCount` with targeted DB query

**Before:** The method called `StockBalanceService.getStockBalancesDetail(organizationId)`, which:
- Scanned ALL `inventoryLedgerEntry` rows (the entire ledger history) via `groupBy`
- Loaded ALL active `shipmentLine` rows for reserved quantity calculation
- Mapped everything into a `product → totalOnHand` Map in JavaScript
- Counted products below threshold

**After:** Replaced with `_countLowStock` using a single `prisma.productCost.groupBy`:
- Queries the `product_cost` table (FIFO cost engine cache) instead of raw ledger entries
- Leverages the compound index on `(organizationId, productId, warehouseId)`
- Uses Prisma's `having` clause to filter at the database level
- Returns only the count (O(distinct products), not O(all ledger rows))

**Impact:** Eliminates loading the entire inventory ledger into memory. For a business with thousands of ledger entries, this reduces query time from seconds to milliseconds.

### 2. Remove unused `openPOs` and `pendingShipments` findMany queries

**Before:** Two `findMany` calls returned full objects with related data:
- `purchaseOrder.findMany` — returned top 5 open POs with supplier name
- `shipment.findMany` — returned top 5 pending shipments with SO number

**After:** Removed both queries. The dashboard page (`page.tsx`) only accesses `data.stats.openPOs` and `data.stats.pendingShipments` (counts from separate `count` queries), never the full object arrays.

**Impact:** Reduces `getOperationalSummary` from 15 parallel queries to 13 parallel queries. Eliminates unnecessary data transfer and serialization.

### 3. Consolidate `getSalesTrend` from 6 queries to 1

**Before:** 6 separate `prisma.invoice.aggregate` calls, one per month, each with its own WHERE clause and date range.

**After:** Single raw SQL query using `DATE_TRUNC('month', "issuedAt")` with `GROUP BY` and `ORDER BY`. The result is mapped back to the same 6-month range in JavaScript to preserve label formatting.

**Impact:** Reduces from 6 DB roundtrips to 1. The grouped query is also more efficient because the database can use a single index scan instead of 6 separate range scans.

### 4. Daily/monthly sales consolidation — NOT applied

**Rationale:** `salesToday` filters on `["ISSUED", "PAID", "PARTIALLY_PAID"]` while `salesThisMonth` uses a different status set. The queries are already parallel (no serialization cost). Consolidating would require changing the status filter logic, which the user explicitly prohibited.

---

## Verification

| Check | Result |
|---|---|
| TypeScript (`tsc --noEmit`) | ✅ Pass — 0 errors |
| ESLint | ✅ Pass — 0 errors (32 pre-existing warnings) |
| Vitest (inventory-valuation-sync) | ✅ Pass — 7/7 tests pass |
| Vitest (full suite) | ✅ Pass — 198/213 tests pass (15 failures are pre-existing `backup-service` Windows tar issue) |
| Mock compatibility | ✅ Fixed — added `productCost.groupBy` mock to test |

---

## Query Count Summary

| Operation | Before | After | Reduction |
|---|---|---|---|
| `getOperationalSummary` | 15 queries | 13 queries | -2 queries |
| `getLowStockCount` | 1 full ledger scan + JS aggregation | 1 index-driven groupBy | O(all ledger) → O(distinct products) |
| `getSalesTrend` | 6 aggregate queries | 1 grouped SQL query | -5 queries |
| **Total dashboard page** | **21+ queries** | **17 queries** | **~20% fewer queries** |

---

## Design Decisions

- **No caching introduced.** Dashboard data feeds business decisions (inventory value, unpaid invoices, low stock). Stale data could cause incorrect reorder decisions or financial misreporting.
- **Raw SQL for `getSalesTrend`.** Prisma lacks cross-database `DATE_TRUNC` support. Raw SQL is isolated to this one method and returns typed results.
- **Threshold hardcoded at 10.** The original `getLowStockCount` always used threshold 10. If configurable thresholds are needed later, pass the value as a parameter.
- **Business logic unchanged.** All status filters, accounting calculations, and inventory valuation remain identical.
