# Development Roadmap

> This document defines the long-term development plan for WBOS.
>
> The roadmap is organized around business capabilities rather than isolated features.
>
> Every phase should leave the application in a stable, deployable, and usable state.
>
> Features should only be considered complete when they successfully support a real business workflow.

---

# Roadmap Philosophy

WBOS is being built as a long-term product.

The roadmap prioritizes:

1. Strong foundations
2. Business value
3. Maintainability
4. Incremental delivery

Each phase builds upon the previous one.

No phase should require major rewrites of earlier work.

---

# Development Principles

Every phase must satisfy the following requirements:

* The application remains deployable.
* Existing functionality continues to work.
* Documentation stays up to date.
* Tests are added for critical business logic.
* Architecture is reviewed before introducing major complexity.

No phase should leave the project in a broken or unfinished state.

---

# Phase 0 — Architecture & Planning

## Goal

Create a complete engineering foundation before writing production code.

## Deliverables

* Project documentation
* Business rules
* Workflows
* Domain model
* Database architecture
* System architecture
* Coding standards
* UI guidelines
* ADR structure
* Roadmap

## Technical Deliverables

* Repository structure
* Documentation structure
* Engineering conventions
* Development workflow

## Exit Criteria

* Documentation reviewed
* Major architectural decisions agreed upon
* Development environment defined

---

# Phase 1 — Foundation

**Status:** Closeout in progress

## Goal

Create a production-ready application foundation.

## Deliverables

* Next.js project
* TypeScript configuration
* Tailwind CSS
* shadcn/ui
* Better Auth
* Prisma
* PostgreSQL
* Docker Compose
* Dark mode
* Sidebar
* Dashboard shell
* Layout system
* Theme support
* Activity logging foundation
* Multi-tenant foundation
* Storage abstraction
* Repository layer
* Service layer

## Business Value

The application becomes operational as a secure platform.

No business workflows are implemented yet.

## Exit Criteria

* Authentication works
* Organization model exists
* Users can log in
* Dashboard loads
* Database migrations work
* Docker environment is reproducible

## Closeout Notes

Infrastructure/database work is complete:

* Remote PostgreSQL connectivity verified.
* Initial Prisma migration created and applied.
* Prisma Client generation verified.
* Prisma Studio verified.

Remaining closeout is application-level:

* Better Auth sign-up, sign-in, sign-out.
* Session persistence.
* Protected routes.
* Initial onboarding after registration.
* Development seed.
* Setup documentation.

---

# Phase 2 — Master Data

## Goal

Create the core business entities that everything else depends on.

## Deliverables

* Products
* Categories
* Suppliers
* Customers
* Warehouses
* Business Settings
* Exchange Rates
* Excel import foundation

## Business Value

The business can define and manage its core data.

No inventory movement occurs yet.

## Exit Criteria

* Products can be managed
* Customers and Suppliers exist
* Warehouses are configurable
* Master data is searchable
* Import validation works

---

# Phase 3 — Inventory

## Goal

Implement the inventory engine.

## Deliverables

* Inventory Transactions
* Inventory Ledger
* Inventory Lots
* FIFO foundation
* Stock adjustments
* Transfers
* Physical counts
* Inventory history

## Business Value

The business can accurately manage inventory.

Inventory becomes the operational heart of WBOS.

## Exit Criteria

* Inventory is transaction-driven
* Current stock is derived
* Inventory history is immutable
* Stock adjustments are audited

---

# Phase 4 — Purchasing

## Goal

Support importing and receiving inventory.

## Deliverables

* Purchase Orders
* Purchase Order Lines
* Shipments
* Receiving workflow
* Supplier returns
* Partial receiving

## Business Value

The business can manage incoming inventory from suppliers.

Receiving products automatically updates inventory.

## Exit Criteria

* Purchase Orders work end-to-end
* Receiving creates inventory transactions
* Inventory lots are created
* Cost history is preserved

---

# Phase 5 — Sales & Payments

## Goal

Support selling products and receiving payments.

## Deliverables

* Invoices
* Invoice lines
* PDF generation
* Payments
* Partial payments
* Credit notes
* Customer balances
* Account statements

## Business Value

The business can complete the entire sales workflow.

Inventory, customers, and payments are fully integrated.

## Exit Criteria

* Invoice workflow complete
* Inventory reduced automatically
* Customer balances calculated correctly
* Payments reconcile successfully

---

# Phase 6 — Reporting & Analytics

## Goal

Transform operational data into business intelligence.

## Deliverables

* Dashboard metrics
* Sales reports
* Inventory reports
* Purchasing reports
* Customer reports
* Supplier reports
* Profit analysis
* Inventory valuation
* Aging reports
* Global search
* Notifications

## Business Value

The business gains visibility into operations and performance.

## Exit Criteria

* Reports match business expectations
* Search is fast and accurate
* Dashboard provides actionable insights

---

# Phase 7 — Business Optimization

## Goal

Improve productivity through automation.

## Deliverables

* Barcode support
* Mobile warehouse workflows
* Bulk operations
* Command palette
* Keyboard shortcuts
* Excel export
* Improved onboarding

## Business Value

Daily work becomes significantly faster.

Manual effort is reduced.

## Exit Criteria

* Warehouse tasks are faster
* Power users rely on keyboard workflows
* Mobile workflows are functional

---

# Phase 8 — Intelligence

## Goal

Use business data to assist decision making.

## Deliverables

* AI assistant
* Demand forecasting
* Purchase recommendations
* Low stock predictions
* Customer insights
* Supplier performance
* Sales forecasting

## Business Value

WBOS evolves from a recording system into a decision-support system.

## Exit Criteria

* AI recommendations provide measurable value
* Forecasting supports purchasing decisions

---

# Phase 9 — Platform Expansion

## Goal

Prepare WBOS for wider adoption.

## Deliverables

* Public API
* Webhooks
* Plugin system
* Third-party integrations
* Multi-warehouse enhancements
* SaaS administration
* Organization management
* Advanced RBAC

## Business Value

WBOS becomes a platform rather than a single application.

## Exit Criteria

* Multiple organizations supported safely
* External systems can integrate cleanly
* Platform remains maintainable

---

# Milestones

## Milestone 1

Foundation Complete

The application is operational.

---

## Milestone 2

Master Data Complete

Products, customers, suppliers, and warehouses exist.

---

## Milestone 3

Inventory Complete

The business can accurately track stock.

---

## Milestone 4

Purchasing Complete

The business can receive imported goods.

---

## Milestone 5

Sales Complete

The business can invoice customers and receive payments.

---

## Milestone 6

Business Ready

WBOS can replace the existing Excel workflow.

---

## Milestone 7

Business Intelligence

Reports and analytics support operational decisions.

---

## Milestone 8

Platform Ready

WBOS is capable of supporting multiple organizations and future commercial deployment.

---

# Definition of Done

A feature is complete only when:

* Business rules are implemented.
* Validation is complete.
* Error handling exists.
* Activity logging is implemented.
* Documentation is updated.
* Tests cover critical business logic.
* The UI follows the design guidelines.
* The implementation follows the architecture.

If any of these are missing, the feature is not complete.

---

# Risk Management

Potential risks include:

* Scope creep
* Premature optimization
* Overengineering
* Incomplete documentation
* Breaking business workflows
* Weak testing
* Inconsistent terminology

Mitigation strategies:

* Follow the roadmap.
* Build incrementally.
* Review documentation before implementation.
* Prefer simple solutions.
* Validate against real business scenarios.

---

# Change Management

The roadmap is a living document.

Changes are expected.

However:

* Business rules should change rarely.
* Architectural changes should be documented through ADRs.
* Roadmap updates should preserve long-term vision.

---

# Success Metrics

WBOS is considered successful when:

* Excel is no longer required for daily operations.
* Inventory accuracy improves.
* Business reporting becomes reliable.
* Daily workflows require fewer manual steps.
* Errors are reduced.
* The software becomes the primary operating system for the business.

Future commercial success is a bonus.

The first measure of success is improving our own business.

---

# Final Principle

Build the right software before building more software.

Every completed phase should leave WBOS stronger, more reliable, and more valuable than before.

The roadmap exists to guide progress—not to encourage rushing toward features.
