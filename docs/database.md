# Database Architecture

> This document defines the database philosophy, domain model, entity relationships, and architectural decisions for WBOS.
>
> It is intentionally implementation-agnostic.
>
> Prisma models, SQL schemas, migrations, and indexes should all be derived from this document.

---

# Database Philosophy

The database is the foundation of WBOS.

Everything else is built on top of it.

The database should represent the real-world business, not the user interface.

Every entity should exist because it models a business concept, not because a screen requires it.

---

# Core Principles

## Business First

Entities should model business objects.

Examples:

* Product
* Customer
* Supplier
* Invoice
* Payment
* Purchase Order
* Warehouse

Not UI concepts.

---

## Data Integrity

The database must always preserve business integrity.

Validation belongs in both:

* Database constraints
* Application logic

The UI should never be the only line of defense.

---

## Immutable History

Historical records should never disappear.

Business history is permanent.

When mistakes occur:

Create correction records.

Do not overwrite history.

---

## Transactions Before State

Whenever practical, state should be derived from transactions.

Examples:

Current Inventory

↓

Inventory Transactions

Customer Balance

↓

Invoices + Payments

This improves auditability and reporting.

---

## Soft Deletes

Business entities should generally be archived rather than deleted.

Deleting historical data should be extremely rare.

---

# Multi-Tenant Architecture

Although WBOS initially serves one business, the architecture should support multiple organizations from day one.

Every business entity should belong to an Organization.

Examples:

Organization

↓

Products

Customers

Suppliers

Invoices

Payments

Purchase Orders

Warehouses

Settings

This adds minimal complexity today while avoiding expensive migrations later.

---

# Domain Model

The database is organized around business domains.

## Organization

Represents a business using WBOS.

Responsibilities:

* Business identity
* Ownership
* Global settings
* Currency
* Configuration

Everything belongs to an Organization.

---

## Products

Represents sellable inventory.

A Product represents what is sold.

It does not represent stock.

A Product contains:

* Identity
* Description
* SKU
* Barcode
* Category
* Pricing
* Status

Inventory belongs elsewhere.

---

## Categories

Products belong to Categories.

Categories exist to improve:

* Organization
* Searching
* Reporting
* Filtering

Categories should support future nesting.

---

## Suppliers

Suppliers provide products.

Suppliers own purchasing relationships.

Supplier history should never be lost.

---

## Customers

Customers purchase products.

Customer records include:

* Contact information
* Payment terms
* Credit limits
* Pricing rules (future)
* Historical purchases

Customer balances should never be stored manually.

They should be derived.

---

## Warehouses

Warehouses represent physical storage locations.

Future versions may support:

Zones

↓

Aisles

↓

Shelves

↓

Bins

The schema should not prevent this expansion.

---

# Purchasing Domain

## Purchase Orders

Purchase Orders represent intent.

Inventory does not change when a Purchase Order is created.

Inventory changes only when products are received.

---

## Purchase Order Lines

Every Purchase Order contains line items.

Each line represents one requested product.

Receiving may occur partially.

Therefore Purchase Order Lines must independently track received quantities.

---

## Shipments

A Shipment represents goods physically arriving.

One Purchase Order may produce multiple Shipments.

One Shipment may contain multiple Products.

---

# Inventory Domain

Inventory is transaction-based.

Inventory is never edited directly.

---

## Inventory Transactions

Inventory Transactions represent every movement of stock.

Supported transaction types include:

* Initial Stock
* Purchase Receipt
* Sale
* Customer Return
* Supplier Return
* Warehouse Transfer
* Adjustment
* Write-Off
* Physical Count

Inventory Transactions are immutable.

---

## Inventory Lots

Inventory Lots represent batches of inventory.

Lots are essential for FIFO costing.

Each Lot belongs to:

* Product
* Supplier
* Purchase Order
* Shipment
* Warehouse

Each Lot stores:

* Original Quantity
* Remaining Quantity
* Unit Cost
* Currency
* Arrival Date
* Expiry Date (future)
* Batch Number (future)

Lots preserve historical costs.

---

# Sales Domain

## Invoices

Invoices represent completed sales.

Invoices own:

* Customer
* Invoice Lines
* Payment Status
* Totals
* Currency

Invoices should never directly modify inventory.

Instead:

Invoice

↓

Inventory Transactions

---

## Invoice Lines

Invoice Lines preserve historical pricing.

Changing a Product later must never modify historical invoices.

Invoice Lines own:

* Product snapshot
* Quantity
* Selling Price
* Discount
* Tax
* Cost snapshot (future)

---

# Payment Domain

Payments are independent business entities.

Payments belong to Customers.

Payments may be allocated across one or more invoices.

Future support:

* Partial payments
* Credit notes
* Refunds

---

# Currency

Primary currency:

KWD (Kuwaiti Dinar)

Supported currencies:

* USD
* EUR

Future currencies should require configuration, not schema changes.

Financial entities should preserve:

* Original Amount
* Currency
* Exchange Rate
* Base Currency Amount
* Exchange Rate Date

Historical values must never change.

---

# Settings

Business Settings belong to an Organization.

Examples:

Business Name

Logo

Invoice Prefix

Default Currency

Timezone

Tax Settings

Document Templates

Warehouse Defaults

Business Settings should not affect historical records.

---

# Activity Logs

Every significant business event should create an Activity Log.

Activity Logs support:

Auditing

Troubleshooting

History

Security

Activity Logs are append-only.

---

# Attachments

Attachments are first-class entities.

Attachments may belong to:

Products

Customers

Suppliers

Purchase Orders

Shipments

Invoices

Payments

The database should support multiple attachments per entity.

---

# Search

Search should operate across multiple entities.

Search indexes should eventually support:

Products

Customers

Suppliers

Invoices

Purchase Orders

Payments

Transactions

Business Settings

The schema should make efficient searching possible.

---

# Derived Data

Certain values should never be manually maintained.

Examples:

Current Stock

↓

Inventory Transactions

Customer Balance

↓

Invoices + Payments

Inventory Value

↓

Inventory Lots

Outstanding Balance

↓

Invoice Total − Payments

Derived values reduce inconsistency.

---

# Relationships

The system is centered around Organizations.

Organization

↓

Products

↓

Inventory Lots

↓

Inventory Transactions

↓

Invoices

↓

Payments

↓

Reports

Customers, Suppliers, Warehouses, Purchase Orders, Shipments, and Settings all belong to the same Organization.

Relationships should reflect real business operations rather than user interface navigation.

---

# Data Lifecycle

Every business entity follows a lifecycle.

Typical lifecycle:

Draft

↓

Active

↓

Completed

↓

Archived

Deletion should be avoided.

Historical records remain available for reporting.

---

# Performance Strategy

Optimize for correctness first.

Optimize for performance only when required.

Possible future optimizations:

* Materialized Views
* Cached aggregates
* Full-text indexes
* Background jobs
* Read replicas

The initial implementation should remain simple.

---

# Future Expansion

The database should support future capabilities without redesign.

Examples:

* Multi-company SaaS
* Multiple warehouses
* Barcode scanning
* Mobile warehouse mode
* AI analytics
* Forecasting
* Public APIs
* Third-party integrations

The schema should be extensible without sacrificing simplicity.

---

# Final Principle

The database exists to model the business—not the application.

If the database accurately represents the business, the application becomes significantly easier to build, maintain, and extend.

Every table, relationship, and constraint should answer one question:

**"Does this represent a real business concept?"**

If the answer is no, the design should be reconsidered.
