# Business Rules

> This document defines the core business rules of WBOS.
>
> These rules are considered the source of truth for business behavior and must always take precedence over implementation convenience.
>
> Any feature that violates these rules should be considered incorrect.

---

# General Principles

## The Database is the Source of Truth

The database represents the true state of the business.

The UI is only a representation of that data.

No user interface should maintain business state independently.

---

## History Must Never Be Lost

Important business events must always be preserved.

Records should generally be archived rather than deleted.

Business history is more valuable than temporary convenience.

---

## Auditability

Every important action must be traceable.

The system should always be able to answer:

* What happened?
* When did it happen?
* Who performed the action?
* Why did it happen?

---

## Transactions Before State

Whenever possible, business state should be derived from transactions instead of directly modified.

Example:

Current inventory is calculated from inventory transactions.

Customer balance is calculated from invoices and payments.

---

# Products

## Product Identity

Every product must have:

* Unique ID
* Unique SKU
* Name
* Category
* Status

Barcodes should be unique when provided.

---

## Product Lifecycle

Product states:

Draft

↓

Active

↓

Discontinued

↓

Archived

Products cannot skip lifecycle stages without explicit administrative action.

---

## Product Deletion

Products must never be permanently deleted.

Instead:

* Archive the product.
* Preserve all historical transactions.
* Preserve invoices.
* Preserve reporting.

---

## Product Updates

Changing product information must never modify historical transactions.

Historical invoices always represent the product information that existed at the time of sale.

---

# Inventory

Inventory is one of the most critical parts of WBOS.

Inventory integrity must never be compromised.

---

## Inventory Cannot Be Edited Directly

There is no "Edit Stock" feature.

Every inventory change must create an inventory transaction.

---

## Inventory Transaction Types

Supported transaction types:

* Initial Stock
* Stock Receipt
* Customer Sale
* Customer Return
* Supplier Return
* Warehouse Transfer
* Stock Adjustment
* Damaged / Write-Off
* Physical Count Adjustment

Future transaction types may be added without modifying historical records.

---

## Inventory Transactions Are Immutable

Inventory transactions must never be edited.

If a mistake occurs:

Create a correcting transaction.

Never overwrite history.

---

## Inventory Calculation

Current stock is calculated from the complete transaction ledger.

Stock values are never manually stored as the primary source of truth.

Optimized summaries or cached values may exist for performance but must always be derived from the transaction ledger.

---

## Negative Inventory

Negative inventory is not allowed unless explicitly enabled by business configuration.

Attempting to sell unavailable inventory should generate a validation error.

---

## Inventory Lots

Every stock receipt should eventually create an inventory lot.

Each lot belongs to:

* Supplier
* Purchase Order
* Shipment
* Warehouse
* Cost
* Arrival Date

Future FIFO costing depends on inventory lots.

---

# Purchasing

## Purchase Orders

Purchase Orders represent the intention to purchase goods.

Receiving inventory without a Purchase Order should only be allowed with appropriate permissions.

---

## Purchase Order States

Draft

↓

Sent

↓

Partially Received

↓

Completed

↓

Cancelled

Only valid state transitions are allowed.

---

## Receiving Stock

Receiving stock must automatically:

* Create inventory transactions
* Create inventory lots
* Update activity log
* Associate stock with supplier
* Preserve purchase cost

---

# Sales

## Customer Orders

Sales always reduce inventory through inventory transactions.

Inventory must never be reduced manually.

---

## Invoice States

Draft

↓

Sent

↓

Partially Paid

↓

Paid

↓

Cancelled

↓

Credit Note (linked entity)

Only valid transitions are permitted.

---

## Invoice Integrity

Once an invoice has been finalized:

* Line items cannot be silently modified.
* Financial history must remain accurate.
* Corrections should create adjustment records or credit notes.

---

## Invoice Numbering

Invoice numbers must be unique.

The numbering strategy is defined by business settings.

Invoice numbers should never be reused.

---

# Customers

## Customer Records

Customers cannot be permanently deleted if they have historical transactions.

Archive instead.

---

## Customer Balance

Customer balances should be derived from:

Invoices

− Payments

± Credit Notes

Manual balance editing is not permitted.

---

## Credit Limits

Customer credit limits should be enforced when enabled.

Authorized users may override credit limits when permitted.

All overrides must be logged.

---

## Payment Terms

Customers may define payment terms such as:

* Cash
* Net 15
* Net 30
* Net 60

Payment terms influence reporting and overdue calculations.

---

# Suppliers

Suppliers cannot be deleted if historical purchasing records exist.

Archive instead.

---

## Supplier Performance

Historical supplier information should always remain available.

Purchase history must never be lost.

---

# Payments

Payments represent money received or paid.

Payments are independent business entities.

---

## Payment States

Pending

↓

Completed

↓

Failed

↓

Refunded

---

## Partial Payments

Invoices may receive multiple payments.

Payments must never exceed the outstanding invoice balance unless specifically allowed.

---

## Payment History

Payments should never be deleted.

Refunds should create additional payment records.

---

# Currency

Primary business currency:

KWD (Kuwaiti Dinar)

Supported currencies:

* USD
* EUR

Future currencies should be supported without schema changes.

---

## Monetary Values

All monetary values must:

* Use Decimal precision.
* Store currency.
* Preserve original transaction values.
* Preserve historical exchange rates when applicable.

Historical financial data must never change because exchange rates changed later.

---

# Activity Logging

The following actions must create activity log entries:

* Login
* Product creation
* Product archive
* Inventory receipt
* Inventory adjustment
* Invoice creation
* Invoice cancellation
* Payment received
* Customer update
* Supplier update
* Purchase Order update
* Business settings update

Activity logs should include:

* Timestamp
* User
* Action
* Entity
* Entity ID
* Optional metadata

---

# Attachments

Attachments may belong to:

* Products
* Customers
* Suppliers
* Purchase Orders
* Shipments
* Invoices
* Payments

Deleting an attachment must never affect business data.

---

# Search

Search must always return current records.

Archived records may optionally appear when filters allow.

Search should eventually support:

* SKU
* Barcode
* Product name
* Customer
* Supplier
* Invoice number
* Purchase Order number
* Payment reference

---

# Permissions

Business rules are always enforced regardless of user permissions.

Permissions determine *who* may perform an action.

Business rules determine *whether* the action is valid.

Permissions must never bypass business integrity.

---

# Importing Data

Imported data must satisfy the same validation rules as manually entered data.

Historical Excel data should be imported as legitimate business records whenever possible.

Initial inventory should be represented using Initial Stock transactions rather than directly assigning stock quantities.

---

# Archiving

Archiving hides records from normal operation.

Archiving must never remove:

* History
* Transactions
* Relationships
* Reports

Archived records remain part of the business history.

---

# Error Handling

Business rule violations should produce clear, human-readable error messages.

The system should explain:

* What failed
* Why it failed
* How to resolve it

Errors should never expose internal implementation details.

---

# Final Principle

Whenever a new feature is proposed, ask the following questions:

1. Does it preserve business integrity?
2. Does it preserve historical accuracy?
3. Does it improve daily operations?
4. Does it follow existing workflows?
5. Can it be audited?

If the answer to any of these questions is "No", the implementation should be reconsidered before development begins.
