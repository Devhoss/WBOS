# Glossary

> This document defines the official terminology used throughout WBOS.
>
> Every document, database model, API, service, UI component, report, and AI assistant should use these definitions consistently.
>
> If a term is not defined here, it is not yet part of the official domain language.

---

# A

## Activity Log

A permanent, append-only record of an important business action.

Examples:

* Product Created
* Stock Received
* Invoice Issued
* Payment Recorded
* Settings Updated

Activity Logs exist for auditing and troubleshooting.

---

## Adjustment

An inventory correction used to fix discrepancies between physical stock and recorded stock.

Adjustments always create Inventory Transactions.

Adjustments never overwrite history.

---

## Archive

The process of removing an entity from normal business operations without deleting its historical records.

Archived records remain available for reporting and auditing.

---

# B

## Barcode

A machine-readable identifier associated with a Product.

Barcodes should be unique within an Organization.

---

## Batch

See **Inventory Lot**.

The terms *Batch* and *Lot* describe the same business concept.

WBOS uses the term **Inventory Lot** consistently.

---

## Business Settings

Organization-wide configuration affecting future operations.

Examples:

* Business name
* Invoice numbering
* Default currency
* Logo
* Tax settings
* Timezone

Historical records are never modified when Business Settings change.

---

# C

## Category

A logical grouping of Products.

Categories improve organization, search, filtering, and reporting.

---

## Credit Limit

The maximum outstanding balance allowed for a Customer.

Credit limits help reduce financial risk.

---

## Credit Note

A financial document used to reverse or partially reverse an Invoice.

Credit Notes preserve history instead of modifying existing Invoices.

---

## Customer

A business or individual purchasing products from the Organization.

Customers own purchasing history but do not own inventory.

---

# D

## Dashboard

The primary overview screen showing the current health of the business.

The Dashboard aggregates information but owns no business data.

---

## Draft

A temporary state where a business entity may still be edited freely.

Examples:

* Draft Product
* Draft Invoice
* Draft Purchase Order

Draft entities have no operational effect until finalized.

---

# E

## Exchange Rate

A historical conversion rate between two currencies.

Exchange Rates are preserved permanently once used in financial transactions.

---

# F

## FIFO (First In, First Out)

The inventory costing methodology used by WBOS.

Products received first are assumed to be sold first.

FIFO allows accurate inventory valuation and profit calculations.

Inventory Lots exist primarily to support FIFO.

---

# I

## Initial Stock

A special Inventory Transaction used during system migration or first-time setup.

Initial Stock should only be used to establish opening balances.

---

## Inventory

The total quantity of products physically owned by the Organization.

Inventory is derived from Inventory Transactions.

It is never edited directly.

---

## Inventory Lot

A batch of inventory received together.

Each Inventory Lot represents inventory sharing the same:

* Supplier
* Purchase Order
* Shipment
* Cost
* Arrival Date

Future versions may also include:

* Expiry Date
* Manufacturing Date
* Batch Number

Inventory Lots enable FIFO costing and inventory traceability.

---

## Inventory Transaction

An immutable record representing one movement of inventory.

Examples include:

* Receipt
* Sale
* Return
* Transfer
* Adjustment
* Write-Off

Inventory Transactions form the inventory ledger.

Current stock is calculated from them.

---

## Invoice

A finalized sales document representing products sold to a Customer.

Invoices preserve historical pricing and generate Inventory Transactions.

Invoices should never directly modify stock.

---

## Invoice Line

A single Product sold within an Invoice.

Invoice Lines preserve the Product information as it existed at the time of sale.

---

# L

## Ledger

An append-only history of business transactions.

Examples:

Inventory Ledger

Financial Ledger (future)

Ledgers preserve historical truth.

Entries are corrected by additional entries rather than modification.

---

## Lot

See **Inventory Lot**.

---

# O

## Organization

A company using WBOS.

Every business record belongs to exactly one Organization.

Organizations provide the foundation for future multi-tenant support.

---

## Outstanding Balance

The remaining amount owed after Payments have been applied to an Invoice or Customer account.

Outstanding balances are derived values.

---

# P

## Partial Payment

A Payment covering only part of an Invoice.

Invoices may receive multiple Partial Payments until fully settled.

---

## Payment

Money received from a Customer or paid to a Supplier.

Payments are independent business entities.

Payments may be allocated across multiple Invoices.

---

## Payment Terms

The agreed period within which payment is expected.

Examples:

* Cash
* Net 15
* Net 30
* Net 60

Payment Terms influence due dates and reporting.

---

## Product

A sellable item offered by the Organization.

Products describe what the item is.

Products do not represent inventory quantities.

---

## Purchase Order (PO)

A document representing the intention to purchase Products from a Supplier.

Purchase Orders do not create inventory.

Inventory is created only when products are received.

---

## Purchase Order Line

A single Product requested within a Purchase Order.

Each line tracks ordered and received quantities independently.

---

# R

## Receipt

An Inventory Transaction created when products are successfully received into the Warehouse.

Receipts increase inventory.

---

## Return

The movement of products back to inventory or back to a Supplier.

Returns always generate Inventory Transactions.

---

# S

## Sale

The completed transfer of Products from the Organization to a Customer.

Sales reduce inventory through Inventory Transactions.

---

## Shipment

A physical delivery of purchased Products.

One Shipment may fulfill all or part of a Purchase Order.

Receiving a Shipment creates Inventory Lots.

---

## SKU (Stock Keeping Unit)

A unique identifier assigned to each Product.

SKUs remain stable throughout the Product lifecycle whenever possible.

---

## Soft Delete

The practice of marking an entity as inactive rather than permanently removing it.

WBOS generally prefers archiving over deletion.

---

## State

The current stage of an entity's lifecycle.

Examples:

Draft

Active

Completed

Archived

State transitions follow defined business rules.

---

## Supplier

A business providing Products to the Organization.

Suppliers own purchasing relationships but never own inventory after receipt.

---

# T

## Tenant

A logical Organization within a multi-tenant deployment.

In Phase 1, each Organization represents one Tenant.

---

## Transaction

A recorded business event.

Transactions represent facts.

They are generally immutable.

Examples:

Inventory Transaction

Payment

Activity Log

---

## Transfer

The movement of inventory between Warehouses or storage locations.

Transfers do not change total inventory.

They only change location.

---

# U

## User

A person using WBOS.

Users perform actions but do not own business entities.

Users are responsible for Activity Logs.

---

# W

## Warehouse

A physical storage location for inventory.

Future warehouse hierarchy:

Warehouse

↓

Zone

↓

Aisle

↓

Shelf

↓

Bin

---

## Workflow

A complete business process performed within WBOS.

Examples:

Receiving Inventory

Creating an Invoice

Recording a Payment

Completing a Physical Stock Count

Workflows are the primary organizing principle of WBOS.

---

## Write-Off

The removal of inventory due to damage, loss, expiry, or other non-sale reasons.

Write-Offs always create Inventory Transactions.

Reasons should always be recorded.

---

# Canonical Naming

The following names should be used consistently throughout the project.

| Preferred Term        | Avoid                                                                 |
| --------------------- | --------------------------------------------------------------------- |
| Organization          | Company, Business                                                     |
| Product               | Item, Goods                                                           |
| Inventory Lot         | Batch, Stock Batch                                                    |
| Inventory Transaction | Stock Movement                                                        |
| Purchase Order        | Order                                                                 |
| Invoice               | Sales Order (unless implementing a separate Sales Order entity later) |
| Payment               | Transaction (too generic)                                             |
| Warehouse             | Store Room                                                            |
| Customer              | Client (unless intentionally distinguishing the two)                  |
| Supplier              | Vendor (choose one term consistently)                                 |
| Activity Log          | Audit Trail (unless referring to the broader concept)                 |

---

# Terminology Guidelines

When introducing new concepts:

1. Prefer business language over technical language.
2. Use one canonical term for one business concept.
3. Avoid synonyms in documentation and code.
4. Database tables, APIs, services, UI labels, and reports should use the same terminology whenever practical.
5. If a new term is introduced, add it to this glossary before using it elsewhere.

---

# Final Principle

Language shapes architecture.

Consistent terminology reduces misunderstandings, improves communication, and makes the codebase easier to understand.

Every contributor—human or AI—should use the vocabulary defined in this glossary as the official language of WBOS.
