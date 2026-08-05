# WBOS — Landed Cost Architecture Proposal

**Status:** Proposal (Do Not Implement)
**Version:** 1.0
**Date:** 2026-08-01
**Related:** `docs/roadmap.md`, `docs/domain-model.md`

---

## 0. Executive Summary

Landed costs are **value-only revaluations of on-hand inventory**. In WBOS they are represented as a new immutable ledger movement type — `LANDED_COST` — with **zero quantity and positive value**, applied through a single new costing primitive (`CostingService.recordRevaluation`). This fits the existing engine exactly the way `PURCHASE_RECEIPT` and `SALE` do today, with **no changes to the reporting layer** and **no rewriting of historical entries**.

**Key decisions**

| Decision | Choice | Why |
|---|---|---|
| Representation | New `LANDED_COST` ledger movement, IN, **quantity 0, value > 0** | Value-only revaluation; on-hand quantity is untouched |
| Costing primitive | `CostingService.recordRevaluation(value)` | Reuses the existing optimistic-lock/retry pattern; the only costing change |
| Allocation | Header basis `BY_VALUE \| BY_QUANTITY \| BY_WEIGHT \| BY_VOLUME \| MANUAL` | Per-expense, per-line split persisted for audit |
| Document | First-class `LandedCost` doc, number `LC-2026-000001`, links to one or more Goods Receipts | Matches existing purchasing document conventions (`DocumentType` + `DocumentSequence`) |
| Already-sold stock | **Adjust remaining on-hand only**; no historical COGS restatement | Immutable ledger; period-consistent reports |
| Fully-sold stock | **Post the uncapitalizable portion to a configurable expense/variance account** — no inventory ledger entry, no `ProductCost` change | Records the real cost without creating value against nothing; ready for future GL (§11.2) |
| Reports | Zero changes. Only the Dashboard Inventory Value card switches to `SUM(productCost.totalValue)` | The card currently uses `defaultSellingPrice` and would otherwise not reflect landed costs |

---

## 1. ERP Comparison

### 1.1 How the major ERPs implement landed costs

| | **Microsoft Dynamics 365 Business Central** | **SAP Business One** | **Oracle NetSuite** | **Odoo** | **ERPNext** |
|---|---|---|---|---|---|
| **Workflow** | Purchase Invoice with "Landed Cost" lines; optionally Item Charges on PO/GRN. Charges are posted to an expense account, then an "Assign Item Charges to Items" action redistributes them to item cost. | Purchase Order → Goods Receipt PO → AP Invoice; Landed Costs entered as "Additional Expenses" on the PO (freight, customs, insurance), distributed to lines at receipt or retroactively. | Purchase Order → Item Receipt → Vendor Bill; "Landed Cost" sublist on the vendor bill (or a Landed Cost transaction) distributes to purchase order lines; Landed Cost Allocation records per-line. | Purchase Order → Receipt → Vendor Bill; "Landed Cost" button on the Vendor Bill opens a wizard that distributes costs across receipt lines and posts a Stock Valuation + a negative bill for the charges. | Landed Cost document is created from a Purchase Receipt; expense items are added and "distributed" across received lines; posting increases the valuation. |
| **Allocation** | By weight, volume, quantity, or value (dimensions on Item Charges). | By quantity, weight, volume, or value; manual overrides per line. | By value, quantity, weight, volume, or custom; also "amortization" over a period. | By quantity, weight, volume, value, or manual. | By quantity, weight, volume, value, or manual. |
| **Effect on valuation** | Revalues on-hand inventory; may also retroactively adjust COGS via cost entries if configured. | Adds to item cost on the remaining stock; with proper setup can also adjust historical COGS. | Adds to inventory asset and revalues on-hand; COGS revaluation optional (amortize). | Adds to inventory value and re-computes the weighted average for on-hand. | Adds to inventory value and recomputes the moving average for on-hand. |
| **Audit history** | Separate "Cost Entries" log; original entries are not rewritten — revaluations are posted as new entries. | Document-based; additional-expense document retains the split; GL tracks clearing vs inventory. | Landed Cost Allocation + Inventory Cost Activity (report) show the trail; original receipts untouched. | Stock Valuation Layer / inventory moves show a "landed cost" move per line; original moves untouched. | Document + Stock Entry referencing the receipt; original receipt untouched. |
| **Notes** | Most mature retroactive COGS support. | Strong for imports (customs/broker workflows). | Strong allocation/amortization model. | Great UX; allocation wizard. | Simplest model; closest to WBOS's ledger shape. |

### 1.2 What WBOS should adopt

- **BC / SAP / NetSuite: per-line allocation basis + persisted per-expense split** for audit (NetSuite's `Landed Cost Allocation` concept). WBOS: `LandedCostAllocation` join table.
- **SAP B1 / NetSuite: landed cost as an independent document step after receiving**, not embedded in the PO. This matches the requested module design.
- **Odoo: "preview before posting" UX** — show the computed allocation matrix before committing.
- **ERPNext: append-only movement + moving-average recompute** — the closest conceptual match to WBOS and the simplest correct model.

### 1.3 What WBOS should avoid

- **BC's retroactive COGS restatement** (default mode that rewinds posted COGS). Contradicts WBOS's immutable ledger and period-consistent reports.
- **Storing landed costs inside the PO** (SAP B1 style) — couples a contingent cost to an order that may be partially received, partially cancelled, or received into multiple warehouses.
- **Odoo's "negative vendor bill" trick** — clever but mixes AP with inventory in a way that complicates future accounting readiness.
- **Custom amortization periods** (NetSuite) — overkill for v1; WBOS posts the cost when the expense is known.
- **Distributing across "all receipts of the product ever"** — must scope to the specific shipment/GRN(s).

---

## 2. Core Mechanism — the `LANDED_COST` Movement

### 2.1 Why a new ledger movement (and the previously-discussed `LANDED_COST`)

The requirement is: increase inventory value, update `ProductCost`, recompute weighted average, keep history immutable, and make every report update without new report logic.

Options considered:

| Option | Verdict |
|---|---|
| **Rewrite historical `PURCHASE_RECEIPT` ledger entries** | ❌ Breaks immutability; destroys audit; rewrites the cost card history and would make past unit costs lie. |
| **Adjust `ProductCost` directly, no ledger rows** | ❌ Ledger stops being the single source of truth; cost history and cost card would miss the event; no audit trail; reports that read the ledger would diverge. |
| **Create a new `InventoryTransaction` + ledger entries with the full received quantity at the new cost** | ❌ Increases on-hand quantity again (double-counts) and corrupts `currentStock`, `aging`, `negativeStock`, and valuation on-hand. |
| **`LANDED_COST` movement: new transaction + **quantity 0**, value > 0** ledger entries, applied via `recordRevaluation` | ✅ Value added, quantity unchanged, ledger append-only, `ProductCost` recomputed, all reports read it automatically. |

**Recommendation: `LANDED_COST` as a new `InventoryMovementType`, `direction IN`, `quantity = 0`, `totalCost = allocated value`, `unitCost = resulting average cost after the event`.**

This is the previously-discussed movement, justified by the ledger-shape fit:

- `InventoryPostingService.post()` already creates transactions, lines, and ledger entries generically. The only change is allowing `quantity = 0` **for this movement type only** (see §8.3).
- `CostingService` already owns every `ProductCost` mutation. Adding `recordRevaluation` is the minimal, single costing change.
- Every report already derives from the ledger + `ProductCost`:

| Report | Reads | Effect of a `LANDED_COST` (qty 0, value V) entry | Code change |
|---|---|---|---|
| Inventory Valuation | `productCost` | `totalValue` and `averageCost` increase | none |
| Product Cost Card | ledger replay | running value += V, running qty += 0 → running avg rises | none |
| Product Cost History | ledger | shows a `LANDED_COST` row (new movement type) | none |
| COGS | OUT ledger entries | future sales at the new average | none |
| Gross Profit | SALE OUT `totalCost` | unchanged for past invoices (history not restated) | none |
| Stock movement summary | transaction lines | may show a 0-qty `LANDED_COST` row | optional filter |
| Dashboard Inventory Value | `productCost` via `InventoryValuationService` | rises | single source shared with the valuation report (§9/§10) |
| currentStock / aging / negativeStock | ledger qty sums | quantity 0 → unchanged (correct) | none |

### 2.2 Why quantity must be 0

`ProductCost` tracks `totalQuantity` and `totalValue`. A revaluation adds value **per unit still on hand**; it must not change quantity. A quantity-carrying IN entry would double-count stock in every quantity report and in `ProductCost.totalQuantity`, which drives the valuation report's on-hand column.

The ledger's `unitCost` for the entry is set to the **resulting weighted average** after the adjustment. This makes the cost history/cost card display the new unit cost at that event — the natural way to read a revaluation — while `totalCost` remains the value added.

---

## 3. Recommended Workflow

The requested workflow is correct and is adopted, with one note (Supplier Invoice is not yet built; the Landed Cost links to the Goods Receipt today and will additionally reference the Supplier Invoice once that module lands).

```
Purchase Order
      │  (approved)
      ▼
Goods Receipt  (GRN-2026-…, posts PURCHASE_RECEIPT, IN qty, unit cost from PO line)
      │
      ▼
Supplier Invoice          ──► future AP module; not required to post a Landed Cost
      │
      ▼
Create Landed Cost  (LC-2026-000001, links to GRN(s), add expenses)
      │
      ▼
Preview Allocation  (choose basis; see matrix; verify total == expenses)
      │
      ▼
Post  (one $transaction)
      │
      ▼
CostingService.recordRevaluation  →  LANDED_COST ledger entries (qty 0, value V)
      │
      ▼
ProductCost  (value + V, average recomputed, quantity unchanged)
      │
      ▼
All reports update automatically (zero report code changes)
```

Why this workflow: it keeps the landed cost a **separate, first-class document** (matching the requested module design), scopes allocation to a specific shipment (the linked GRN(s)), and adds value only when a real expense is known (freight today, customs next week, broker next month — each is its own document).

---

## 4. Purchasing Module Structure

```
Purchasing
├── Purchase Orders        (existing)
├── Receiving              (existing)
├── Supplier Invoices      (future module, not built yet)
├── Landed Costs           (NEW)
└── Suppliers              (existing)
```

Landed Costs are **not** embedded in Purchase Orders. A PO can be received across several GRNs, into several warehouses, and attract several different expense documents over time — a single landed-cost-per-PO model cannot represent that.

---

## 5. Landed Cost Document

**Document number:** `LC-2026-000001` via the existing `DocumentNumberService` (`DocumentType.LC`, prefix `LC`, per-org per-year sequence). Generated at creation like every other WBOS document.

| Field | Type | Notes |
|---|---|---|
| `lcNumber` | String | unique per org |
| Supplier | relation (optional) | defaults from linked GRN |
| Status | `DRAFT \| POSTED \| CANCELLED` | |
| Allocation basis | enum | `BY_VALUE \| BY_QUANTITY \| BY_WEIGHT \| BY_VOLUME \| MANUAL` |
| Posting date | Date | becomes ledger `occurredAt` |
| Currency / exchange rate | document-level default | each expense overrides |
| Notes | String | |
| **Expenses** (1..n) | see below | Ocean/Air Freight, Customs, Insurance, Broker, Local Transport, Port Fees, Documentation, Other |
| **Lines** (1..n) | snapshot of the GRN content | product, warehouse, qty, invoice value, weight, volume, allocated amount, posting treatment (CAPITALIZED/EXPENSED) |
| **Linked receipts** (1..n) | GRN transactions | `LandedCostReceipt` join |
| **Allocations** | per line × per expense | audit of the split |
| **Audit** | created by, created at, posted by, posted at, cancelled by, cancelled at, linked inventory transaction | |

**Expense row:** `expenseType`, `description`, `currency`, `exchangeRate` → base, `amount` (expense currency), `baseAmount` (base currency = amount × rate).

**Line row:** `productId`, `warehouseId`, `unitOfMeasureId`, `quantity`, `invoiceValue` (base), `weightTotal`, `volumeTotal`, `allocatedAmount` (base). Lines are auto-populated from the linked GRN and editable only in DRAFT.

---

## 6. Allocation Engine

### 6.1 Inputs

- Lines L = { l1..ln } with `quantity`, `invoiceValue`, `weightTotal`, `volumeTotal`.
- Expenses E with `baseAmount`; total base `B = Σ baseAmount`.
- Basis.

### 6.2 Formulas (weight = share; allocate B)

| Basis | Weight of line i | Requirement |
|---|---|---|
| BY_VALUE | `w_i = invoiceValue_i / Σ invoiceValue` | invoiceValue populated |
| BY_QUANTITY | `w_i = qty_i / Σ qty` | quantities consistent |
| BY_WEIGHT | `w_i = weightTotal_i / Σ weightTotal` | weight on every line |
| BY_VOLUME | `w_i = volumeTotal_i / Σ volumeTotal` | volume on every line |
| MANUAL | user-specified | must reconcile to B |

Allocated value: `v_i = B × w_i`. Final split per expense per line: `s_{i,e} = B_e × w_i`.

**Rounding:** Decimal math at `(18,6)`. A residual `B − Σ v_i` (from rounding) is assigned to the largest line so the ledger totals always reconcile to the expense total.

### 6.3 Advantages / disadvantages

| Basis | Pros | Cons |
|---|---|---|
| **BY_VALUE** | Default; matches how freight/customs are usually charged (proportional to goods value); no master-data dependency | Expensive product in a cheap shipment bears too much; distorted by transfer-pricing between related companies |
| **BY_QUANTITY** | Simple, intuitive for homogeneous cartons | Meaningless when products have very different sizes/prices or mixed units of measure |
| **BY_WEIGHT** | Physically accurate for freight/customs-by-weight | Requires `weightPerUnit` on every product; must snapshot at line level |
| **BY_VOLUME** | Physically accurate for air/sea volumetric charges | Requires `volumePerUnit`; needs the same snapshot discipline |
| **MANUAL** | Exact control; handles bespoke agreements | User is responsible for reconciliation; more error-prone |

**Recommendation:** default **BY_VALUE**, with BY_QUANTITY/BY_WEIGHT/BY_VOLUME offered and **MANUAL** reserved for exceptions (e.g., a broker invoice item billed to one product only). Require weight/volume master data before a weight/volume basis is selectable.

---

## 7. Weighted Average Behavior in Every Edge Case

Definitions for a product in a warehouse: on-hand `Q`, value `V`, average `A = V/Q`. All math is Decimal `(18,6)`, inside one transaction, with optimistic locking.

- **Receipt** (IN qty u, unit cost c): `V' = V + u·c`, `Q' = Q + u`, `A' = V'/Q'`.
- **Issue** (OUT qty u): cost at current `A`: `V' = V − u·A`, `Q' = Q − u`, `A' = V'/Q'`.
- **Landed cost** (value +v, qty unchanged): `V' = V + v`, `Q' = Q`, `A' = V'/Q`. **Requires Q > 0** (see §11.2).
- **Landed cost reversal** (value −v, qty unchanged): `V' = V − v`, `A' = V'/Q`.

**Multiple products / mixed values:** allocation distributes B by basis (§6.2); each product revalues independently. An expensive product in a low-value shipment (BY_VALUE) receives a proportional share — its `A'` moves more in relative terms only if its value share dominates.

**Multiple landed cost documents (freight now, customs later, broker later):** each is an independent revaluation on its own posting date. The ledger replays them in `occurredAt` order; the cost card's running average steps up at each event. `ProductCost` reflects the cumulative total.

**Partial sales before the landed cost:** recommended behavior = **revalue remaining on-hand only** (§11.3). The posted `SALE` ledger entries keep their original `totalCost`; past COGS and Gross Profit are not restated. The landed cost value is added to `ProductCost` for whatever is on hand at posting, so future issues carry the corrected average.

**Fully sold before the landed cost:** `Q = 0` → a revaluation would divide by zero and create value out of nothing. **WBOS does not capitalize the line**; its allocation is posted to a configurable expense/variance account with **no inventory ledger entry** — the real cost is recorded (and will map to GL), but `ProductCost` is untouched. See §11.2.

**Partial receipts (one PO, several GRNs):** each GRN is its own received lot with its own `ProductCost` contribution. A Landed Cost links to the specific GRN(s) it covers; allocation runs over the linked lines only.

**Multiple warehouses:** receiving is per-warehouse. Link multiple GRNs (one per warehouse) to the same Landed Cost; each line carries its warehouse and revalues that warehouse's `ProductCost`.

**Warehouse transfers before the landed cost:** transfers are value-neutral (`recordIssue` at A to source, `recordReceipt` at A to destination), so the value travels with the stock. At posting, WBOS finds where the product's on-hand currently is and revalues **that** location (see §11.5). If the product sits in several warehouses, the line's value is split proportionally to current on-hand in each.

**Purchase returns after landed cost:** `SUPPLIER_RETURN` issues at the (inflated) average, which automatically includes the landed-cost component. No special handling.

**Customer returns after landed cost:** `CUSTOMER_RETURN` receipts at the issue cost / average; `ProductCost` already carries the landed cost. No special handling.

**Multi-currency:** allocation and `ProductCost` are always in the company base currency (`BusinessSettings.defaultCurrency`, default `KWD`). Each expense stores its own `currency` + `exchangeRate`, converted to `baseAmount` at entry. Future: a daily FX-rate table keyed `(currency, date)` to auto-fill rates — an additive table, **no schema redesign**.

---

## 8. Posting Algorithm (click **Post**)

Inside **one** `prisma.$transaction`:

1. **Load + validate.** Status must be `DRAFT`. Role must allow post (§17). At least one expense with `baseAmount > 0`; at least one line; every line `quantity > 0`.
2. **Validate linked receipts.** Each `LandedCostReceipt` references a `POSTED` `PURCHASE_RECEIPT` inventory transaction in the same org.
3. **Validate basis prerequisites.** BY_WEIGHT/BY_VOLUME require weight/volume on every line; BY_QUANTITY requires consistent quantities; MANUAL requires `Σ allocated = B` (within tolerance, else error).
4. **Recompute allocation** (unless MANUAL) and **resolve the rounding residual** (§6.2).
5. **Evaluate on-hand per line.** For every line, check the product's current on-hand in the target warehouse(s) (§11.2 / §11.5). If `Q > 0` → the line will be **capitalized** (revalued). If `Q = 0` → the line is marked **EXPENSED**: its allocation is not revalued and instead becomes a variance-account value for future GL; the document still posts (unless a strict block mode is enabled for the org).
6. **Build the `LANDED_COST` transaction** via `InventoryPostingService.post(tx)`:
   - `type: LANDED_COST`, `documentNumber: lcNumber`, `referenceType: "LANDED_COST"`, `referenceId: landedCost.id`, `occurredAt: postingDate`, `createdById: context.userId`.
   - One transaction line per product-warehouse; one ledger entry per line: `direction IN`, `quantity 0`, `totalCost = allocated share`, `unitCost = (filled by costing as the resulting average)`.
7. **Apply costing** — for each ledger entry, `CostingService.recordRevaluation({ value: +share, ledgerEntryId })` with the standard optimistic-lock + 3-retry loop. `ProductCost.totalValue += share`; `averageCost` recomputed; quantity untouched.
8. **Persist audit:** `LandedCostAllocation` rows (per line × per expense), update `LandedCost.status = POSTED`, `postedById`, `postedAt`, `inventoryTransactionId`.
9. **Activity log** (`LANDED_COST_POSTED`, entity = the transaction; summary includes LC number, GRN references, total value).

**Rollback:** any validation failure or costing conflict rolls the whole transaction back — no ledger rows, no `ProductCost` change, status stays `DRAFT`. The preview screen runs steps 1–5 (read-only) before enabling the Post button, so the user sees errors before committing.

---

## 9. Reversal / Cancellation

Only a `POSTED` document can be cancelled. Cancellation posts an immediate **reversal** (append-only, never mutates the original):

1. Load the posted `LANDED_COST` ledger entries and their allocated values.
2. Inside one transaction, post a new `LANDED_COST` transaction (`occurredAt = now`, referenceType `LANDED_COST_REVERSAL`, referenceId = original LC): per original entry, `direction OUT`, `quantity 0`, `totalCost = original value`, and `CostingService.recordRevaluation({ value: −share, ledgerEntryId })`.
3. Set `status = CANCELLED`, `cancelledById`, `cancelledAt`.
4. Activity log (`LANDED_COST_CANCELLED`, links reversal transaction).

Net effect on `ProductCost`: value returns to pre-posting, quantity never moved. The cost card shows an IN `LANDED_COST` and an OUT `LANDED_COST` — a complete, auditable nullification. Draft documents cancel with no ledger effect (nothing was posted).

---

## 10. Inventory Integration & Report Impact

- **Ledger:** append-only `LANDED_COST` entries (qty 0). The original `PURCHASE_RECEIPT` and `SALE` entries are never touched.
- **ProductCost:** value-added revaluation; weighted average recomputed; optimistic locking preserved.
- **InventoryReportService:** **no code changes** (see the table in §2.1). The `LANDED_COST` movement type automatically appears in cost history/cost card because those reports read the ledger generically.
- **Dashboard Inventory Value card — implemented via a single shared valuation source:** `InventoryValuationService` (`src/domains/inventory/services/inventory-valuation-service.ts`) reads `SUM(productCost.totalValue)` and is the single source for both the Inventory Valuation report (`InventoryReportService.valuation()`) and the dashboard/KPI cards (`DashboardService.getInventoryValue()`, `KpiService.inventoryValue()`). Because every screen reads the same method, the dashboard always equals the valuation report and reflects landed costs, receipts, sales, transfers, adjustments, and reversals. This is the only report-side change and it is a correctness fix, not landed-cost-specific logic.
- **The Landed Cost module contains zero reporting logic.** All reads stay on the ledger, `ProductCost`, and `CostingService`.

---

## 11. Edge Cases

### 11.1 Multiple products / mixed values
Allocation distributes the expense pool by the chosen basis across the linked GRN lines. Each product revalues its own `ProductCost`. `BY_VALUE` naturally apportions more to expensive lines; `BY_QUANTITY` weights raw units; `BY_WEIGHT`/`BY_VOLUME` weight physical attributes.

### 11.2 Fully sold inventory (on-hand = 0)

A revaluation requires `Q > 0` (§7): capitalizing against zero on-hand would divide by zero and create inventory value out of nothing. Two behaviors were compared:

| | **Block the posting** | **Post to expense/variance account (recommended)** |
|---|---|---|
| Cost recorded in WBOS | No — the document stays stuck in DRAFT; the real freight/customs expense has no home (WBOS has no expense module yet), so the cost silently leaks out of the system | Yes — the document posts; the uncapitalizable portion is flagged on the line and carried for future GL |
| Inventory value | Correct (nothing added) | Correct (nothing added to `ProductCost`) |
| Immutable ledger | Preserved (nothing posted) | Preserved (no inventory ledger entry for the expensed portion) |
| Accounting readiness | Dead-end until a deferral path exists | Ready: the portion maps to `Debit Import/COGS variance`, `Credit` clearing/AP/accrued (§15) |
| Risk of abuse | Low, but the cost is unrecorded | Low — the condition is objective (`Q = 0`), not a free user choice, so costs cannot be casually pushed out of inventory |

**Recommendation: post the uncapitalizable portion to a configurable expense/variance account (default behavior).**

Rationale: the expense is real and must be recorded somewhere; blocking leaves it unrecorded with no alternative in WBOS; the variance leg gives future accounting a clean hook (`LandedCostExpenseGLMapping`) without touching inventory or the ledger. An optional strict "block instead" mode can be offered as a per-organization setting, and deferring the cost to a future receipt remains a documented future enhancement. The cost-matching caveat (the cost economically belongs to past COGS) is acknowledged and can be refined later by booking the variance to a COGS-adjustment account rather than a current-period operating expense.

### 11.3 Partial sales before the landed cost
Recommended: **adjust remaining inventory only**. The full allocated value is applied to on-hand, so the remaining units absorb the cost; past COGS/Gross Profit are not restated. Rationale:
- The ledger is immutable; restating COGS would require correction entries that rewrite the meaning of past financial periods.
- Weighted-average reporting is period-consistent: each period reflects the average in effect when sales were posted.
- The alternative (retroactive COGS revaluation, BC-style) contradicts the "never rewrite historical transactions" requirement.
- Consequence to document: if a large portion was already sold, remaining units carry a higher per-unit value than the shipment's true cost. Accepted for v1.

### 11.4 Multiple landed cost documents
Independent documents, independent revaluations on their own posting dates; `ProductCost` is cumulative; the cost card steps up per event. No cross-document locking beyond the normal per-`ProductCost` optimistic lock.

### 11.5 Warehouse transfers before the landed cost
At posting, WBOS locates the product's current on-hand across warehouses. If all of it is in the line's warehouse, revalue there. If it has been transferred, revalue the warehouse(s) now holding it, splitting the line's value **proportionally to current on-hand** in each, so every location's average moves correctly and total revaluation equals the allocation.

### 11.6 Partial receipts
The Landed Cost links to the specific GRN(s). Allocation runs over the linked received quantities only — never over the whole PO.

### 11.7 Multiple warehouses
One LC links multiple GRNs (one per warehouse). Each line carries its own warehouse; each revalues that warehouse's `ProductCost`.

### 11.8 Purchase returns after landed cost
`SUPPLIER_RETURN` issues at the inflated average → the landed-cost portion is refunded proportionally. No special handling.

### 11.9 Customer returns after landed cost
`CUSTOMER_RETURN` receipts at the issue cost/average → the returned units re-enter at landed-cost-inclusive value. No special handling.

### 11.10 Multi-currency
Per-expense `(currency, exchangeRate)` → `baseAmount`. Future daily FX-rate table is additive. `ProductCost` stays in base currency. Rounding of converted amounts documented per accounting policy (§15).

---

## 12. Database Design

### 12.1 New enums

```prisma
enum LandedCostStatus        { DRAFT POSTED CANCELLED }
enum LandedCostAllocationBasis { BY_VALUE BY_QUANTITY BY_WEIGHT BY_VOLUME MANUAL }
enum LandedCostExpenseType   { OCEAN_FREIGHT AIR_FREIGHT CUSTOMS_TAX INSURANCE CUSTOMS_BROKER LOCAL_TRANSPORT PORT_FEES DOCUMENTATION OTHER }
enum LandedCostPostingTreatment { CAPITALIZED EXPENSED }
```

**Extended enums** (PostgreSQL enum append = additive, safe):
```prisma
enum InventoryMovementType { ... LANDED_COST }   // existing enum + one value
enum DocumentType          { ... LC }            // existing enum + one value
```

### 12.2 New models

```prisma
model LandedCost {
  id                   String                   @id @default(cuid())
  organizationId       String
  lcNumber             String
  supplierId           String?
  status               LandedCostStatus         @default(DRAFT)
  allocationBasis      LandedCostAllocationBasis @default(BY_VALUE)
  postingDate          DateTime?
  currency             CurrencyCode             @default(KWD)
  exchangeRate         Decimal                  @default(1) @db.Decimal(18, 6)
  notes                String?
  createdById          String
  postedById           String?
  cancelledById        String?
  postedAt             DateTime?
  cancelledAt          DateTime?
  inventoryTransactionId String?                // the LANDED_COST posting
  createdAt            DateTime                 @default(now())
  updatedAt            DateTime                 @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  supplier     Supplier?    @relation(fields: [supplierId], references: [id], onDelete: Restrict)
  createdBy    User?        @relation(fields: [createdById], references: [id], onDelete: Restrict)
  postedBy     User?        @relation(fields: [postedById], references: [id], onDelete: SetNull)
  cancelledBy  User?        @relation(fields: [cancelledById], references: [id], onDelete: SetNull)
  expenses     LandedCostExpense[]
  lines        LandedCostLine[]
  receipts     LandedCostReceipt[]
  allocations  LandedCostAllocation[]

  @@unique([organizationId, lcNumber])
  @@index([organizationId, status])
  @@index([organizationId, supplierId])
  @@map("landed_costs")
}

model LandedCostExpense {
  id             String               @id @default(cuid())
  organizationId String
  landedCostId   String
  expenseType    LandedCostExpenseType
  description    String?
  currency       CurrencyCode
  exchangeRate   Decimal              @db.Decimal(18, 6)
  amount         Decimal              @db.Decimal(18, 3)  // in expense currency
  baseAmount     Decimal              @db.Decimal(18, 6)  // amount * exchangeRate

  landedCost LandedCost @relation(fields: [landedCostId], references: [id], onDelete: Cascade)
  allocations LandedCostAllocation[]

  @@index([organizationId, landedCostId])
  @@map("landed_cost_expenses")
}

model LandedCostLine {
  id              String   @id @default(cuid())
  organizationId  String
  landedCostId    String
  productId       String
  warehouseId     String
  unitOfMeasureId String
  quantity        Decimal  @db.Decimal(18, 6)
  invoiceValue    Decimal  @db.Decimal(18, 6)   // base currency, for BY_VALUE
  weightTotal     Decimal? @db.Decimal(18, 6)
  volumeTotal     Decimal? @db.Decimal(18, 6)
  allocatedAmount Decimal  @db.Decimal(18, 6)   // result (editable when MANUAL)
  postingTreatment LandedCostPostingTreatment?  // CAPITALIZED or EXPENSED, set at post (§11.2)

  allocations LandedCostAllocation[]

  @@index([organizationId, landedCostId])
  @@index([organizationId, productId])
  @@index([organizationId, warehouseId])
  @@map("landed_cost_lines")
}

model LandedCostReceipt {
  id                   String @id @default(cuid())
  organizationId       String
  landedCostId         String
  inventoryTransactionId String // linked GRN (PURCHASE_RECEIPT) transaction

  @@unique([landedCostId, inventoryTransactionId])
  @@index([inventoryTransactionId])
  @@map("landed_cost_receipts")
}

model LandedCostAllocation {
  id             String   @id @default(cuid())
  organizationId String
  landedCostId   String
  lineId         String
  expenseId      String
  amount         Decimal  @db.Decimal(18, 6)  // base currency share

  @@unique([landedCostId, lineId, expenseId])
  @@index([organizationId, landedCostId])
  @@map("landed_cost_allocations")
}
```

**Product additions** (for weight/volume bases):
```prisma
model Product {
  // ...
  weightPerUnit Decimal? @db.Decimal(18, 6)
  volumePerUnit Decimal? @db.Decimal(18, 6)
}
```

### 12.3 Index rationale / migration impact

- All list queries filter `organizationId + status` and join supplier → covered by `@@index([organizationId, status])` + `@@index([organizationId, supplierId])`.
- Allocation previews and posting load a document by `lcNumber` (unique) and its children by `landedCostId` → covered.
- `LandedCostReceipt.inventoryTransactionId` → reverse lookup from a GRN to its LCs.
- Migration is **additive only**: new tables, two appended enum values, two nullable Product columns. No backfill, no rewrite. Safe against a `db:fresh`.
- Extensibility: per-expense currency/rate means a future FX table needs no schema change; the allocation table generalizes to future bases (e.g., BY_TARIFF_CODE) without redesign.

---

## 13. Service Architecture

```
                    ┌──────────────────────────────┐
                    │      LandedCostService        │  orchestrates; validates status/roles;
                    │  (domain, no reporting)       │  create/update draft, link GRN, post, cancel
                    └──────────────┬───────────────┘
                                   │
                    ┌──────────────▼───────────────┐
                    │       AllocationService       │  pure functions: weight + split + rounding
                    │  (stateless, unit-testable)   │  input: lines, expenses, basis → per-line, per-expense
                    └──────────────┬───────────────┘
                                   │  value + ledgerEntryId
                    ┌──────────────▼───────────────┐        ┌─────────────────────────────┐
                    │       CostingService          │◄───────│ InventoryPostingService      │
                    │  recordRevaluation()          │        │ post(type: LANDED_COST,      │
                    │  (only costing change)        │        │  qty 0 allowed)              │
                    └──────────────────────────────┘        └─────────────────────────────┘
                                   │
                    ┌──────────────▼───────────────┐
                    │   InventoryLedgerRepository   │  create entries (already generic)
                    │   + InventoryTransactionRepo  │
                    └──────────────────────────────┘
```

**Responsibilities**

- **`LandedCostService`** — create/update draft; link GRNs; run preview (read-only); post (single `$transaction` calling the other three services); cancel/reverse; audit log; role guard. **No reporting logic, no allocation math, no costing math.**
- **`AllocationService`** — pure allocation computation (bases, rounding, residual resolution, validation of basis prerequisites). Zero I/O. Used by preview and by post.
- **`CostingService`** — the single owner of `ProductCost`. Add one method `recordRevaluation({ organizationId, productId, warehouseId, value, ledgerEntryId }, tx)` with the same optimistic-lock/retry pattern as `recordReceipt`/`recordIssue`. **No changes to the other methods.**
- **`InventoryPostingService`** — allow `quantity = 0` only when `movementType === "LANDED_COST"` (both directions). Everything else unchanged.
- **`InventoryReportService` / `DashboardService`** — the dashboard/KPI inventory value and the valuation report now share `InventoryValuationService` as the single source (§10); no other report changes.

No duplication: the module calls `InventoryPostingService` + `CostingService` exactly as `GoodsReceiptService` and `WarehouseTransferService` already do.

---

## 14. UI Proposal

### 14.1 Navigation
`Purchasing → Landed Costs` as a section alongside Purchase Orders / Receiving / Suppliers (Supplier Invoices when it exists).

### 14.2 List page — `/purchasing/landed-costs`
- Status badges: `DRAFT` (neutral), `POSTED` (success), `CANCELLED` (muted/red).
- Filters: status, supplier, date range, warehouse (via linked GRN).
- Search: LC number, supplier name.
- Columns: LC number, supplier, status, posting date, total expense (base), allocated value, linked GRNs (count), posted by, actions.
- Linked-document affordance: row expands to show linked GRN numbers and (future) supplier invoice.

### 14.3 Create/Edit page — `/purchasing/landed-costs/new`, `/[id]/edit`
1. **Link receipts** — pick GRN(s) (only `POSTED` PURCHASE_RECEIPTs not already fully allocated to a posted LC). Populates lines automatically.
2. **Expenses** — add expense rows (type, description, currency, rate, amount → live base conversion). Running total.
3. **Lines** — review auto-populated products/warehouses/quantities; edit invoice value, weight, volume (snapshot).
4. **Basis selector** + allocation compute (see preview).
5. **Notes**, posting date.

### 14.4 Preview Allocation screen (before posting) — `/purchasing/landed-costs/[id]/allocate`
- Header: LC number, supplier, status, total expenses (base), allocated total.
- **Allocation matrix:** rows = lines, columns = expenses, cells = computed share; last column = per-line total; last row = per-expense total and the grand total.
- Basis toggle re-computes the matrix live (client-side via the same pure `AllocationService` math, server-verified at post).
- **Reconciliation banner:** `allocated total == expense total` with the rounding residual highlighted (resolved to the largest line).
- MANUAL mode: editable cells + per-row/per-column totals and a validation message when out of balance.
- **Post button** — runs the server validation (role, basis prerequisites) and shows errors inline. Lines with zero on-hand at post are flagged as **EXPENSED** in the preview (see §11.2) so the user sees which portion will be capitalized vs. expensed before committing.

### 14.5 Audit trail
A detail page section showing: created by/at, posted by/at, cancelled by/at, the linked `LANDED_COST` inventory transaction, all `LandedCostAllocation` rows, and a link to the cost card/history for the affected products. Also surfaced in the activity log.

### 14.6 Permissions & mobile
- View list/detail/audit: `VIEWER` + all roles.
- Create/edit draft, link GRNs: `WAREHOUSE`, `FINANCE`, `MANAGER`, `ADMIN`, `OWNER`.
- **Post / Cancel:** `FINANCE`, `ADMIN`, `OWNER`.
- Service-level guard `assertRole(context, [...])` on post/cancel (the existing auth context already carries `role`).
- **Mobile:** read-only (list + detail + audit). Creation/edit is desktop-first (allocation matrix is a desktop interaction). Mobile view on the receiving flow can link a GRN and show its landed-cost status.

---

## 15. Accounting Readiness

Not implemented now; the schema is designed to drive a future GL without redesign:

- **Inventory Asset** — the `LANDED_COST` ledger entries (value V) are the inventory side of the journal: `Debit Inventory Asset` (sum of allocations), `Credit` split by expense type to clearing/AP accounts.
- **Freight / Customs Clearing** — a future `LandedCostExpenseType → GL account` mapping table turns each expense into a credit leg. Until the clearing is billed, the credit balances as an accrued/clearing account.
- **Accrued Expenses / Accounts Payable** — the same mapping can post to `Accrued Expenses` (freight/customs not yet invoiced) or directly to `AP` (broker invoice received). Per-expense currency/rate already carry the FX information needed.
- **Import / COGS variance** — lines posted with `postingTreatment = EXPENSED` (on-hand = 0 at posting) debit a configurable variance/expense account instead of Inventory Asset; the credit leg is unchanged. This is where the fully-sold landed cost lands (§11.2). A future `LandedCostExpenseGLMapping` table maps `expenseType → GL account` and the expensed allocations are its source of truth, so accounting never re-derives the split.
- **Reversal** — cancelling an LC generates the inverse journal, mirroring the ledger reversal.
- **Reconciliation** — invariant: `Σ baseAmount(expenses) = Σ allocation(ledger value) = Σ GL inventory debit`, guaranteed by the posting algorithm.
- The `LandedCostAllocation` table is the source for GL line attribution, so accounting never recomputes or reallocates.

---

## 16. Workflow Diagram

```
 PO ──► GRN (PURCHASE_RECEIPT, IN qty, cost from PO)
          │
          ▼
      ┌────┴─────────────┐
      │  Create Landed Cost │
      │  • link GRN(s)      │
      │  • add expenses     │
      └────┬─────────────┘
          │
          ▼
      ┌────┴─────────────┐
      │  Preview Allocation │──► matrix, basis, reconciliation
      └────┬─────────────┘
          │
          ▼
      ┌────┴─────────────┐
      │      Post          │  (one $transaction)
      └────┬─────────────┘
          │
          ▼
  InventoryTransaction(LANDED_COST, qty 0, value V)
          │
          ▼
  CostingService.recordRevaluation  ──► ProductCost (value +V, avg up, qty same)
          │
          ▼
  Ledger + ProductCost  ──► Valuation • Cost Card • Cost History • COGS • Gross Profit • Dashboard
          │
          └──► CANCELLED (reversal) ──► OUT LANDED_COST, value −V
```

---

## 17. Permissions (RBAC)

| Capability | VIEWER | WAREHOUSE | SALES | FINANCE | MANAGER | ADMIN | OWNER |
|---|---|---|---|---|---|---|---|
| View list/detail/audit | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create / edit draft | — | ✅ | — | ✅ | ✅ | ✅ | ✅ |
| Link GRNs | — | ✅ | — | ✅ | ✅ | ✅ | ✅ |
| **Post** | — | — | — | ✅ | — | ✅ | ✅ |
| **Cancel (reversal)** | — | — | — | ✅ | — | ✅ | ✅ |
| Manage weight/volume master data | — | — | — | — | ✅ | ✅ | ✅ |

Posting affects inventory valuation, so it is finance/owner-controlled. Enforced in `LandedCostService` via the role on `AuthenticatedRequestContext`.

---

## 18. Testing Strategy

### Unit
- `AllocationService`: each basis formula; rounding residual resolution; zero-total guards (Σ value = 0, Σ weight = 0); MANUAL reconciliation pass/fail; per-expense split sums to total.
- Multi-currency conversion: `amount × rate`, rounding to base.
- `CostingService.recordRevaluation`: value added, quantity unchanged, average formula; **optimistic-lock retry** (concurrent revaluations); value on zero quantity throws; reversal (negative value).
- Posting validation: wrong status, no expenses, no lines, missing weight for BY_WEIGHT, linked GRN not posted, on-hand = 0.

### Integration
- Post an LC → assert new `LANDED_COST` transaction/lines/entries (qty 0, totalCost = allocation) + `ProductCost` value/avg and **unchanged** quantity.
- Reports after post: valuation value up; cost card running avg steps at the LC event; cost history shows `LANDED_COST`; COGS of a subsequent sale at the new average; Gross Profit of a **past** sale unchanged.
- Cancel → reversal entries + `ProductCost` value back to pre-posting + status CANCELLED + audit rows.
- Multiple LCs on one shipment (freight/customs/broker) → cumulative value, correct order in cost card.
- Partial sales before LC → remaining on-hand revalued, historical COGS untouched.
- **Fully sold before LC → posting succeeds; the line is marked `EXPENSED`, no inventory ledger entry is created, `ProductCost` is unchanged, and the variance value is recorded on the document/allocation rows.**
- **Expensed portion GL fixture → debit variance account, credit clearing/AP/accrued, totals reconcile to `Σ baseAmount`.**
- Warehouse transfer before LC → revaluation lands on the current location; multi-location split proportional to on-hand.
- Purchase return / customer return after LC → averages include landed cost.
- Multi-currency expenses → base conversion correct in allocations and ledger.
- Permissions: VIEWER cannot post; FINANCE can.

### Edge / performance
- Large shipment (e.g., 10,000 lines): allocation is O(lines × expenses) in-memory; posting uses batched inserts; verify no N+1 on `recordRevaluation` (it is per line × warehouse — acceptable; optimize with a single pass per ProductCost key).
- Concurrency: two LCs posting for the same product simultaneously → retry loop succeeds or surfaces `COST_CONCURRENCY_CONFLICT`.
- Rollback: force a failure mid-post (e.g., injected on-hand conflict) → assert zero ledger rows, zero ProductCost change, status stays DRAFT.

### Audit verification
- Ledger immutability: diff original `PURCHASE_RECEIPT` / `SALE` rows before vs after an LC post → byte-identical.
- `LandedCostAllocation` rows equal the expense split; grand totals reconcile to `Σ baseAmount`.

---

## 19. Migration Impact Summary

- **Additive migration:** new tables `landed_costs`, `landed_cost_expenses`, `landed_cost_lines`, `landed_cost_receipts`, `landed_cost_allocations`; append `LANDED_COST` to `InventoryMovementType` and `LC` to `DocumentType`; two nullable columns on `Product`.
- **No backfill, no data rewrite, no column type changes.** `prisma migrate` + `db:fresh` remain clean.
- **Runtime impact:** one new costing primitive; one validation relaxation in posting; one dashboard value-source fix. All other code untouched.

---

## 20. Open Questions / Deferred (not blocking)

- Supplier Invoice module (the workflow step after GRN) — build before or after Landed Costs? Landed Costs do not depend on it.
- Deferred allocation: attach a landed-cost share to a **future** receipt of the same product (for "cost known before goods arrive"). Post-v1 enhancement; distinct from the expensed-on-sale behavior (§11.2).
- Daily FX-rate table and per-expense rounding policy.
- Whether `LANDED_COST` rows should be hidden or grouped in the Stock Movement summary report (cosmetic).
- Whether cancel should require a reason (recommend adding `cancellationReason` string).
