# WBOS – Project Bible

> **Wholesale Business Operating System**
>
> The definitive vision, philosophy, and guiding principles for the project.

---

# Our Mission

WBOS exists to simplify the daily operations of wholesale import businesses by replacing disconnected spreadsheets and manual processes with a modern, reliable, and intuitive business operating system.

We are building software that we want to use ourselves every day.

Our business is the first customer, and every feature must solve a real operational problem before it is considered complete.

---

# Why WBOS Exists

Our business currently relies on multiple Excel spreadsheets to manage inventory, invoices, purchasing, and stock.

Although this approach has worked, it introduces several limitations:

* Duplicate data entry
* Manual calculations
* Human error
* Poor reporting
* Difficult searching
* No complete audit trail
* Limited scalability

WBOS exists to eliminate these problems while providing a strong foundation for future growth.

---

# Product Vision

WBOS is not simply an inventory application.

It is a complete operating system for wholesale businesses.

Inventory is the operational heart of the system, but every business function should work together as one connected workflow.

The long-term vision is to create software that can eventually serve wholesalers throughout the Gulf region while remaining focused on solving our own daily operational challenges first.

---

# Our Business

We are a family-owned wholesale snack import business.

Our primary workflow is:

Supplier

↓

Purchase Order

↓

Import Shipment

↓

Warehouse Receiving

↓

Inventory

↓

Customer Orders

↓

Invoices

↓

Payments

↓

Reporting

WBOS is designed around these workflows rather than around individual screens or database tables.

---

# Guiding Principles

Every decision made during development should follow these principles.

## Business First

Business workflows always come before user interface design.

The software should model how the business actually operates.

---

## Simplicity Wins

Choose the simplest solution that correctly solves the problem.

Avoid unnecessary complexity.

Avoid building features "just in case."

---

## Data Integrity Above Everything

Business data must always be accurate.

Convenience should never compromise correctness.

The database is the source of truth.

---

## History Must Never Be Lost

Important business events should never disappear.

The system should record what happened, when it happened, and who performed the action.

---

## Build for Today, Prepare for Tomorrow

WBOS is built for our company today.

However, architectural decisions should avoid preventing future expansion into a SaaS platform.

---

## User Experience Matters

Powerful software should still feel enjoyable to use.

Fast interfaces, excellent search, keyboard shortcuts, thoughtful defaults, and clear feedback are essential features—not optional extras.

---

# Engineering Philosophy

Technology exists to support the business.

We value:

* Readability over cleverness
* Maintainability over shortcuts
* Consistency over personal preference
* Clear architecture over unnecessary abstraction

Every new feature should make the codebase easier to understand rather than harder.

---

# Product Philosophy

WBOS is workflow-driven.

We do not build isolated CRUD pages.

Instead, we build complete business processes.

For example:

Receiving a shipment should automatically:

* Update inventory
* Record inventory transactions
* Associate stock with the correct supplier
* Preserve costing information
* Create activity logs

The user should complete one workflow while the system performs the required business operations automatically.

---

# Inventory Philosophy

Inventory is one of the most important assets of the business.

Inventory quantities are never edited directly.

Instead, every stock movement creates a transaction.

Examples include:

* Initial stock
* Purchase receipt
* Customer sale
* Customer return
* Supplier return
* Stock adjustment
* Warehouse transfer
* Damaged goods
* Physical inventory count

Current stock is derived from the complete transaction history.

This ensures transparency, auditability, and long-term reliability.

---

# Financial Philosophy

Money is business-critical.

Financial data must always be accurate.

The application should:

* Use decimal values for all monetary calculations.
* Never use floating-point values for money.
* Preserve historical costs.
* Support future multi-currency operations.
* Keep complete financial history.

Accuracy is always more important than convenience.

---

# Long-Term Vision

WBOS should eventually support:

* Multiple warehouses
* Inventory lot tracking
* FIFO costing
* Barcode scanning
* Mobile warehouse workflows
* AI-powered business insights
* Demand forecasting
* Multi-company support
* Third-party integrations
* Public APIs
* Plugin architecture

These features are intentionally not part of the first implementation, but today's architecture should not prevent tomorrow's capabilities.

---

# What We Are Not Building

WBOS is not trying to become an enterprise ERP on day one.

We are intentionally avoiding unnecessary complexity such as:

* Microservices
* Distributed systems
* Event buses
* CQRS read models
* Complex accounting
* Machine learning
* Over-engineered infrastructure

Complexity should only be introduced when justified by real business needs.

---

# Definition of Success

WBOS is successful when our business naturally prefers using it over Excel.

Success is measured by:

* Less manual work
* Fewer mistakes
* Faster workflows
* Better reporting
* Greater confidence in business data
* Better operational decisions

Technology itself is never the goal.

Improving the daily operation of the business is the goal.

---

# The North Star

Every feature should answer one question:

**"Will this save time, reduce mistakes, or help us make better business decisions every single day?"**

If the answer is no, the feature should be reconsidered.

This principle should guide every architectural decision, every feature request, and every line of code written for WBOS.
