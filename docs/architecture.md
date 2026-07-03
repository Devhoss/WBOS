# System Architecture

> This document defines the high-level software architecture of WBOS.
>
> It describes how the system is organized, how information flows through the application, and the engineering principles used throughout development.
>
> This document intentionally avoids implementation details such as Prisma schemas or specific API endpoints. Those belong in lower-level technical documentation.

---

# Architecture Goals

The architecture of WBOS is designed around five primary goals.

1. Maintainability
2. Scalability
3. Reliability
4. Simplicity
5. Business-first design

Every architectural decision should improve at least one of these goals without unnecessarily compromising the others.

---

# Architecture Philosophy

WBOS is designed using a modular monolith architecture.

This provides the simplicity of a single deployable application while allowing clear separation between business domains.

A modular monolith is intentionally chosen because:

* The application is developed by a small team.
* It reduces operational complexity.
* It keeps development fast.
* It avoids premature distributed systems.
* It allows future extraction into services if required.

We are intentionally **not** building microservices.

---

# System Overview

```text
                    Browser
                        │
                        ▼
                Next.js Application
                        │
        ┌───────────────┼────────────────┐
        │               │                │
        ▼               ▼                ▼
 Presentation      Application      Infrastructure
     Layer            Layer              Layer
        │               │                │
        └───────────────┼────────────────┘
                        │
                        ▼
                  PostgreSQL
```

Every request flows downward through these layers.

Dependencies always point toward the database.

Never in reverse.

---

# Layered Architecture

WBOS follows a layered architecture.

## Presentation Layer

Responsible for:

* Pages
* Layouts
* Components
* Forms
* Tables
* Dialogs
* User interactions

The Presentation Layer should contain little or no business logic.

Its responsibility is displaying information and collecting user input.

---

## Application Layer

Responsible for:

* Business workflows
* Validation
* Authorization
* Transaction orchestration
* Domain coordination

This is the heart of the application.

Application services translate business workflows into actions.

---

## Domain Layer

Responsible for business knowledge.

Contains:

* Business rules
* Domain services
* Domain events
* Business invariants

The Domain Layer must remain independent of the user interface.

---

## Infrastructure Layer

Responsible for:

* Database
* Authentication
* File storage
* Email
* Search
* Logging
* Docker
* External integrations

Infrastructure supports the application but should not define business behavior.

---

# Business Domains

WBOS is organized around domains rather than technical folders.

Primary domains include:

* Organization
* Products
* Inventory
* Purchasing
* Suppliers
* Customers
* Sales
* Payments
* Warehouses
* Reporting
* Settings
* Administration

Every domain owns:

* Business rules
* Services
* Validation
* Components
* Types
* Tests

---

# Request Lifecycle

A typical request follows this path.

```text
Browser

↓

Page / Component

↓

Server Action or Route Handler

↓

Application Service

↓

Domain Service

↓

Repository

↓

Prisma

↓

PostgreSQL
```

Every layer has one responsibility.

Business logic should never skip layers.

---

# Folder Structure

The project should follow a domain-first structure.

```text
src/

app/

domains/

components/

lib/

repositories/

providers/

hooks/

types/

utils/

generated/
```

Each domain should contain its own:

* Components
* Services
* Validation
* Types
* Tests

Cross-domain utilities belong in shared infrastructure.

---

# Service Layer

Business logic belongs inside services.

Examples:

InventoryService

InvoiceService

PurchaseOrderService

CustomerService

PaymentService

Services coordinate workflows.

They do not render UI.

---

# Repository Layer

Repositories isolate database access.

Responsibilities:

* Query data
* Persist data
* Hide ORM details

Business services should not depend directly on Prisma.

Replacing Prisma should require minimal business logic changes.

---

# Validation

Every external input must be validated.

Validation occurs:

* Client-side (UX)
* Server-side (security)

Zod should be the primary validation library.

The server is always authoritative.

---

# Authentication

Authentication identifies users.

Authorization determines what users may do.

Authentication should remain independent from business logic.

Better Auth is the preferred authentication solution.

---

# Authorization

Permissions belong to the Organization.

Future roles include:

* Owner
* Manager
* Sales
* Warehouse

Authorization should always be enforced on the server.

The client should never determine permissions.

---

# Multi-Tenancy

Every business entity belongs to an Organization.

Organization isolation is mandatory.

Business logic must never accidentally access another organization's data.

Multi-tenancy should be implemented from the beginning.

---

# Database Access

The database is accessed only through repositories.

Never access Prisma directly from UI components.

Never expose raw database models to the presentation layer.

---

# Transaction Management

Business workflows often require multiple database operations.

Example:

Receive Shipment

↓

Create Inventory Lots

↓

Create Inventory Transactions

↓

Update Purchase Order

↓

Create Activity Log

These operations should execute within a single database transaction whenever consistency is required.

---

# Error Handling

Errors fall into four categories.

Business Errors

Validation Errors

Infrastructure Errors

Unexpected Errors

Every error should provide meaningful feedback while avoiding exposure of internal implementation details.

---

# Logging

Logging exists for developers.

Activity Logs exist for the business.

These are different concepts.

Technical logs help debug software.

Activity Logs explain business events.

---

# File Storage

Files should never contain business logic.

Files belong to business entities.

Storage implementation should remain abstract.

Local storage is used initially.

Future migration to S3-compatible storage should require minimal code changes.

---

# Search

Search is infrastructure.

Search consumes business data.

Search never owns business data.

Future implementations may use PostgreSQL Full Text Search before introducing dedicated search engines.

---

# Background Jobs

Background processing is intentionally postponed.

When introduced, it should handle:

* Report generation
* Scheduled reminders
* Notification delivery
* Data synchronization

Core business workflows should remain synchronous unless there is a demonstrated need.

---

# API Strategy

Phase 1 primarily uses:

* Server Actions
* Route Handlers

Business logic should remain independent of transport mechanisms.

Future REST or GraphQL APIs should reuse the same services.

---

# External Integrations

Future integrations may include:

* Payment gateways
* Shipping providers
* Barcode scanners
* Accounting software
* AI services

All integrations belong in the Infrastructure Layer.

Business logic should remain independent from external providers.

---

# Observability

The system should always make it easy to understand:

* What happened?
* When did it happen?
* Why did it happen?
* Who performed the action?

Observability includes:

* Activity Logs
* Structured logging
* Metrics
* Health checks

---

# Deployment

WBOS is designed for Docker-first deployment.

Development:

* Windows 11
* Docker Desktop
* PostgreSQL
* Next.js Development Server

Production:

* Docker Compose
* PostgreSQL
* Homelab
* Reverse Proxy
* Automated Backups

The deployment target should not affect application behavior.

---

# Future Evolution

The architecture should allow future expansion without major rewrites.

Potential future capabilities include:

* Public API
* Mobile applications
* AI assistants
* Multi-company SaaS
* Multiple warehouses
* Event-driven integrations

These should be enabled by the architecture, not implemented prematurely.

---

# Engineering Principles

Every architectural decision should follow these principles:

* Prefer simple solutions.
* Prefer composition over inheritance.
* Prefer explicitness over magic.
* Prefer readability over cleverness.
* Optimize for maintainability before optimization.
* Never compromise business integrity.
* Keep business logic independent of the UI.
* Design around business domains.
* Document important decisions.
* Build software that future developers will enjoy maintaining.

---

# Final Principle

Architecture is not about making software more complicated.

Architecture is about making change easier.

Every decision should reduce future complexity while helping the business operate more effectively.

If a design makes the software harder to understand without providing meaningful business value, it should be rejected.
