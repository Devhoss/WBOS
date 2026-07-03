# Domain Model

> This document defines the core business entities that make up WBOS.
>
> It is the canonical vocabulary of the system.
>
> Every database table, service, workflow, API, report, and UI component should use the terminology defined here.
>
> If a concept is not defined here, it is not yet part of the business domain.

---

# Domain Philosophy

WBOS models a real wholesale import business.

Every entity represents a real business object.

Entities should never exist solely because they make the software easier to build.

Instead, the software should reflect how the business actually operates.

---

# Domain Hierarchy

The system is organized into business domains.

```text
Organization
│
├── Products
├── Suppliers
├── Customers
├── Warehouses
├── Purchasing
├── Inventory
├── Sales
├── Payments
├── Reporting
└── Administration
```

Each domain owns its own business rules.

---

# Organization

## Purpose

Represents a company using WBOS.

Everything in the system belongs to exactly one Organization.

## Responsibilities

* Business identity
* Global configuration
* Currency
* Users
* Permissions
* Business settings

## Owns

* Products
* Customers
* Suppliers
* Warehouses
* Purchase Orders
* Inventory
* Invoices
* Payments

---

# User

## Purpose

Represents a person using WBOS.

A User performs business actions.

## Responsibilities

* Authentication
* Authorization
* Activity ownership

Users do not own business data.

They perform actions against it.

---

# Product

## Purpose

Represents something the business buys and sells.

A Product describes what the item is.

It does **not** represent inventory.

## Responsibilities

* Identity
* SKU
* Barcode
* Description
* Category
* Pricing defaults
* Supplier relationship
* Status

## Relationships

Belongs to:

* Organization
* Category

Referenced by:

* Purchase Orders
* Inventory Lots
* Inventory Transactions
* Invoice Lines

---

# Category

## Purpose

Groups similar products.

Categories improve:

* Navigation
* Reporting
* Search
* Analytics

Categories should support hierarchical nesting.

---

# Supplier

## Purpose

Represents a business that sells products to us.

## Responsibilities

* Contact information
* Payment terms
* Lead times
* Purchasing history

Referenced by:

* Products
* Purchase Orders
* Shipments
* Inventory Lots

---

# Customer

## Purpose

Represents a business purchasing products from us.

## Responsibilities

* Contact information
* Credit limit
* Payment terms
* Outstanding balance
* Purchase history

Referenced by:

* Invoices
* Payments

---

# Warehouse

## Purpose

Represents a physical storage location.

Future hierarchy:

Warehouse

↓

Zone

↓

Aisle

↓

Shelf

↓

Bin

Warehouse structure should remain extensible.

---

# Purchase Order

## Purpose

Represents an agreement to purchase products from a supplier.

Purchase Orders do **not** create inventory.

Inventory is created only when products are received.

## Owns

Purchase Order Lines

## Produces

Shipments

---

# Purchase Order Line

## Purpose

Represents one requested product within a Purchase Order.

Tracks:

* Ordered Quantity
* Received Quantity
* Unit Cost
* Currency

Supports partial receiving.

---

# Shipment

## Purpose

Represents a physical delivery of products.

A Shipment converts purchasing into inventory.

One Purchase Order may generate multiple Shipments.

A Shipment may contain multiple Products.

---

# Inventory Lot

## Purpose

Represents a batch of inventory received together.

Inventory Lots exist primarily to support FIFO costing and inventory traceability.

Each Lot stores:

* Product
* Supplier
* Purchase Order
* Shipment
* Unit Cost
* Currency
* Arrival Date
* Remaining Quantity

Future fields:

* Batch Number
* Expiry Date
* Manufacturing Date

---

# Inventory Transaction

## Purpose

Represents one inventory movement.

This is one of the most important entities in WBOS.

Inventory Transactions are immutable.

Examples:

* Receipt
* Sale
* Return
* Transfer
* Adjustment
* Write-Off

Inventory Transactions create inventory history.

Current inventory is derived from them.

---

# Invoice

## Purpose

Represents a completed sale.

Invoices describe what was sold.

They do not directly manipulate inventory.

Instead they generate Inventory Transactions.

## Owns

Invoice Lines

Referenced by:

Payments

Credit Notes

Reports

---

# Invoice Line

## Purpose

Represents one product sold.

Invoice Lines preserve historical information.

They store:

* Product snapshot
* Selling price
* Quantity
* Discount
* Tax

Historical invoices never change when products change.

---

# Payment

## Purpose

Represents money received from customers.

Payments exist independently from invoices.

Payments may be allocated across multiple invoices.

Supports:

* Partial payments
* Multiple payments
* Refunds

---

# Credit Note

## Purpose

Represents a reversal or correction of an Invoice.

Credit Notes never erase history.

They create additional business events.

---

# Activity Log

## Purpose

Represents an auditable record of significant business actions.

Examples:

Invoice Created

Stock Received

Payment Recorded

Product Archived

Activity Logs exist for accountability.

---

# Attachment

## Purpose

Represents files attached to business records.

Supported attachments include:

* Images
* PDFs
* Purchase documents
* Shipping documents
* Contracts

Attachments should never contain business logic.

---

# Business Settings

## Purpose

Represents organization-wide configuration.

Examples:

* Business Name
* Logo
* Invoice Prefix
* Default Currency
* Tax Settings
* Timezone

Settings affect future operations only.

Historical records remain unchanged.

---

# Exchange Rate

## Purpose

Represents a currency conversion rate.

Supports future multi-currency purchasing.

Stores:

* Source Currency
* Target Currency
* Rate
* Effective Date

Historical exchange rates must never change.

---

# Product Price

## Purpose

Represents a pricing rule.

Future support includes:

* Customer pricing
* Promotional pricing
* Tiered pricing
* Wholesale pricing

Products should support multiple pricing strategies without schema redesign.

---

# Report

## Purpose

Represents derived business information.

Reports never own business data.

They only consume existing data.

Reports should never modify business entities.

---

# Notification

## Purpose

Represents information requiring user attention.

Examples:

* Low Stock
* Overdue Invoice
* Shipment Arrival
* Payment Due

Notifications should always be derived from business events.

---

# Search Index

## Purpose

Provides fast access to business entities.

Search is an infrastructure concern.

It does not own business data.

---

# Relationships Overview

The following relationships describe the overall domain model.

```text
Organization
│
├── Users
├── Products
│     ├── Categories
│     ├── Inventory Lots
│     ├── Inventory Transactions
│     └── Invoice Lines
│
├── Suppliers
│     ├── Purchase Orders
│     └── Shipments
│
├── Customers
│     ├── Invoices
│     └── Payments
│
├── Warehouses
│     └── Inventory Lots
│
├── Business Settings
├── Activity Logs
├── Attachments
└── Reports
```

---

# Domain Ownership

Every entity owns its own business rules.

Examples:

Products own product information.

Inventory Transactions own stock history.

Inventory Lots own inventory costing.

Invoices own sales.

Payments own financial settlement.

Reports own no business data.

Ownership should remain clear throughout the application.

---

# Domain Events

Future versions of WBOS may expose domain events.

Examples:

ProductCreated

StockReceived

InvoiceIssued

PaymentRecorded

CustomerCreated

SupplierUpdated

Events should describe something that has already happened.

Events should never contain business logic.

---

# Ubiquitous Language

The following terms have fixed meanings throughout WBOS.

**Product** — A sellable item.

**Inventory Lot** — A received batch of inventory.

**Inventory Transaction** — A movement of stock.

**Purchase Order** — A request to purchase goods.

**Shipment** — Physical delivery of purchased goods.

**Invoice** — A completed sale.

**Payment** — Money received or paid.

**Warehouse** — Physical storage location.

**Organization** — A company using WBOS.

These definitions should remain consistent across documentation, code, APIs, database models, and user interfaces.

---

# Final Principle

The Domain Model is the shared language of WBOS.

Every developer, AI assistant, database model, API endpoint, and business workflow should speak this language consistently.

If a new concept cannot be clearly defined within this document, it should not be introduced into the system until its purpose and responsibilities are fully understood.
