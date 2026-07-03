# Accounting Principles

> This document defines the financial and accounting principles used throughout WBOS.
>
> WBOS is **not** intended to replace professional accounting software.
>
> Instead, it provides accurate operational financial data to support day-to-day business decisions.
>
> Every financial calculation, report, and dashboard should follow the principles defined here.

---

# Purpose

The purpose of this document is to ensure that every financial calculation in WBOS is:

* Consistent
* Explainable
* Reproducible
* Auditable

Business reports should never rely on undocumented assumptions.

---

# Financial Philosophy

Financial history represents facts.

Facts do not change.

If a mistake occurs:

Create a correcting record.

Do not silently modify historical transactions.

Historical accuracy is more important than convenience.

---

# Primary Currency

WBOS uses:

**KWD (Kuwaiti Dinar)**

as its operational reporting currency.

However, purchasing and selling may occur in multiple currencies.

The original currency is always preserved.

---

# Supported Currencies

Phase 1 supports:

* KWD
* USD
* EUR

Future currencies should be added through configuration.

---

# Financial Records

Financial records include:

* Purchase Orders
* Supplier Invoices
* Inventory Lots
* Sales Invoices
* Payments
* Credit Notes
* Exchange Rates

Every record is part of the permanent business history.

---

# Revenue Recognition

Revenue is recognized when an Invoice is issued and finalized.

Draft invoices do not contribute to financial reports.

Cancelled invoices do not contribute to revenue.

Credit Notes reduce previously recognized revenue.

---

# Cost Recognition

The cost of inventory is recognized when inventory is sold.

WBOS calculates Cost of Goods Sold (COGS) using:

FIFO

↓

Inventory Lots

↓

Historical Purchase Cost

Current Product prices are never used for historical profit calculations.

---

# Gross Profit

Gross Profit is calculated as:

```text id="j3wmuq"
Revenue

−

Cost of Goods Sold

=

Gross Profit
```

Gross Profit excludes operating expenses.

---

# Net Profit

Phase 1 does not calculate accounting Net Profit.

Operational reporting focuses on:

* Revenue
* COGS
* Gross Profit
* Inventory Value

Future versions may include additional operating expenses and taxes.

---

# Inventory Valuation

Inventory is valued using:

FIFO

↓

Remaining Inventory Lots

↓

Historical Purchase Cost

Inventory value reflects the cost of remaining inventory rather than current market price.

---

# Landed Cost

Inventory cost may include more than the supplier's unit price.

Future landed cost calculations may include:

* Purchase Cost
* Freight
* Shipping
* Customs Duties
* Import Fees
* Insurance
* Local Transportation

These additional costs should be allocated proportionally across the received Inventory Lots.

Phase 1 stores the architecture required for landed cost but may initially use purchase cost only.

---

# Exchange Rates

Every currency conversion records:

* Original Currency
* Target Currency
* Exchange Rate
* Conversion Date

Historical exchange rates never change.

Reports always use the historical exchange rate captured with the transaction.

---

# Customer Balance

Customer Balance is derived.

Conceptually:

```text id="6qj3gl"
Invoices

−

Payments

−

Credit Notes

=

Outstanding Balance
```

Outstanding balances are never entered manually.

---

# Supplier Balance

Supplier balances follow the same principle.

Outstanding supplier obligations are derived from:

* Purchase Documents
* Supplier Payments
* Supplier Credit Notes (future)

---

# Payments

Payments are independent financial records.

One Payment may settle:

* One Invoice
* Multiple Invoices
* Part of an Invoice

Payments do not modify historical invoices.

Instead, they reduce the outstanding balance.

---

# Credit Notes

Credit Notes reverse financial impact.

They never overwrite the original Invoice.

They preserve financial history while correcting business mistakes.

---

# Returns

Customer Returns

* Increase inventory.
* Reduce revenue through Credit Notes.
* Reverse COGS appropriately.

Supplier Returns

* Reduce inventory.
* Reverse supplier purchasing where applicable.

Returns should preserve the original business history.

---

# Inventory Adjustments

Inventory adjustments are operational corrections.

Examples include:

* Damage
* Theft
* Counting errors
* Expired products

Adjustments should be categorized with a reason.

Adjustments affect inventory valuation but should remain distinguishable from normal sales.

---

# Discounts

Discounts reduce revenue.

Discounts should be recorded explicitly rather than modifying Product prices.

This preserves historical pricing information.

---

# Taxes

Phase 1 assumes minimal tax requirements.

The architecture should support future expansion for:

* VAT
* GST
* Sales Tax
* Multiple tax jurisdictions

Tax calculations should remain separate from Product pricing whenever possible.

---

# Financial Precision

All monetary values use Decimal arithmetic.

Floating-point calculations are prohibited.

Rounding should occur only:

* When presenting values
* When legally required
* At clearly defined calculation boundaries

---

# Financial Reports

Examples include:

* Sales Summary
* Gross Profit
* Inventory Valuation
* Customer Balances
* Supplier Balances
* Outstanding Receivables
* Outstanding Payables
* Purchasing Summary

Every report must be reproducible from historical records.

---

# Source of Truth

Each financial concept has one authoritative source.

| Financial Concept | Source of Truth                      |
| ----------------- | ------------------------------------ |
| Revenue           | Finalized Invoices                   |
| COGS              | Inventory Lots + FIFO                |
| Inventory Value   | Remaining Inventory Lots             |
| Customer Balance  | Invoices + Payments + Credit Notes   |
| Supplier Balance  | Purchase Records + Supplier Payments |
| Exchange Rate     | Historical Exchange Rate Record      |
| Product Cost      | Inventory Lots                       |
| Selling Price     | Invoice Line Snapshot                |

Duplicate financial data should be avoided.

Derived values should be recalculated rather than stored unless there is a demonstrated performance need.

---

# Reports vs Accounting Software

WBOS provides operational financial reporting.

Official accounting responsibilities such as:

* Tax filing
* Statutory reporting
* General Ledger
* Trial Balance
* Balance Sheet
* Income Statement

remain the responsibility of dedicated accounting software or a qualified accountant.

Future integrations with accounting platforms may synchronize relevant financial information.

---

# Guiding Principles

Every financial feature should follow these principles.

* Financial history is immutable.
* Original currency is preserved.
* Historical exchange rates never change.
* Inventory valuation uses FIFO.
* Product prices never rewrite historical invoices.
* Customer balances are derived.
* Reports are reproducible.
* Every financial number should be explainable.

If a report cannot explain where a number came from, the implementation should be reconsidered.

---

# Final Principle

Financial software succeeds when users trust the numbers.

Every calculation in WBOS should prioritize:

* Accuracy
* Consistency
* Traceability
* Transparency

Trust is earned through predictable financial behavior.

Every report should answer not only:

> **"What is the number?"**

but also:

> **"Why is that the correct number?"**
