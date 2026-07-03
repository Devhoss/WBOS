# Coding Standards

> This document defines the engineering standards for WBOS.
>
> Every line of code written for the project should follow these conventions.
>
> Consistency is more valuable than personal preference.

---

# Engineering Philosophy

WBOS is expected to be maintained for many years.

Code should be written for the next developer, not the current one.

The goal is not to write the shortest code.

The goal is to write the clearest code.

Every developer should optimize for:

* Readability
* Maintainability
* Predictability
* Simplicity
* Correctness

---

# General Principles

## Write Code for Humans

Computers execute code.

Humans maintain it.

Always optimize for readability.

---

## Simplicity Wins

Choose the simplest solution that correctly solves the problem.

Avoid unnecessary abstractions.

Avoid clever code.

---

## One Responsibility

Every file, class, function, and component should have one clear responsibility.

---

## Business Logic First

Business logic belongs inside services.

Never inside UI components.

Never inside pages.

Never duplicated.

---

## Explicit is Better than Implicit

Avoid hidden behavior.

Prefer code that is obvious over code that is magical.

---

# TypeScript Standards

TypeScript is mandatory.

Do not bypass the type system.

## Never Use `any`

Avoid `any`.

Prefer:

* unknown
* generic types
* utility types
* proper interfaces

If `any` is absolutely necessary, document why.

---

## Prefer Type Inference

Do not annotate obvious types.

Good:

```ts
const products = [];
```

Bad:

```ts
const products: Product[] = [];
```

when inference already provides the same result.

---

## Shared Types

Shared types belong inside the domain that owns them.

Cross-domain types belong inside `shared`.

Avoid duplicate interfaces.

---

# File Organization

Keep files small.

Target:

200–300 lines maximum.

If a file grows significantly larger, consider splitting it.

---

# Folder Organization

Organize by business domain.

Example:

```text
domains/

inventory/

customers/

payments/

invoices/
```

Do not organize primarily by technical type.

Avoid folders such as:

```text
components/

hooks/

services/

utils/
```

containing everything mixed together.

---

# React Standards

Use functional components only.

Prefer Server Components whenever appropriate.

Use Client Components only when interactivity is required.

---

## Components

Components should:

* be focused
* be reusable
* remain small

Large components should be decomposed.

---

## Props

Keep props simple.

Avoid passing unnecessary objects.

Prefer explicit props.

---

## State

Use local state whenever possible.

Do not introduce global state unless clearly justified.

---

# Next.js Standards

Use the App Router.

Prefer:

Server Components

↓

Server Actions

↓

Route Handlers

Avoid unnecessary client-side fetching.

---

# Business Services

Business workflows belong inside services.

Examples:

InventoryService

InvoiceService

PurchaseOrderService

CustomerService

PaymentService

Services coordinate business operations.

They should not know anything about React.

---

# Repository Layer

Repositories own database access.

Only repositories interact directly with Prisma.

Never query Prisma directly inside:

* Components
* Pages
* Server Actions

---

# Validation

Validate every external input.

Use Zod.

Validation exists in two places:

Client

↓

User Experience

Server

↓

Security

Never trust client input.

---

# Error Handling

Errors should be explicit.

Prefer:

```text
InventoryUnavailableError
```

Instead of:

```text
Error("Something went wrong")
```

Business errors should explain:

* What happened
* Why
* How to resolve it

---

# Logging

Do not log sensitive information.

Log useful information.

Separate:

Technical Logs

Business Activity Logs

They serve different purposes.

---

# Naming Conventions

Use names that describe business concepts.

Good:

InventoryTransaction

PurchaseOrder

OutstandingBalance

Bad:

Data

Manager

Helper

Thing

---

## Variables

Use descriptive names.

Avoid abbreviations unless universally understood.

Good:

remainingQuantity

Bad:

rq

---

## Functions

Functions should describe actions.

Examples:

createInvoice()

receiveShipment()

recordPayment()

archiveProduct()

Avoid vague names.

---

# Comments

Code should explain **how**.

Comments should explain **why**.

Avoid commenting obvious code.

Good comments explain business decisions.

---

# Constants

Avoid magic numbers and strings.

Use named constants.

Bad:

```ts
if (status === 4)
```

Good:

```ts
if (status === InvoiceStatus.PAID)
```

---

# Async Code

Always use async/await.

Avoid nested Promise chains.

Handle errors intentionally.

---

# Database

Database access belongs inside repositories.

Business logic belongs inside services.

Never expose Prisma models directly to the UI.

---

# Transactions

Whenever a workflow modifies multiple business entities, use database transactions.

Example:

Receive Shipment

↓

Create Inventory Lot

↓

Create Inventory Transaction

↓

Update Purchase Order

↓

Create Activity Log

All or nothing.

---

# Testing

Every critical business workflow should be testable.

Prioritize:

* Business rules
* Inventory calculations
* Financial calculations
* State transitions

Business logic should not require React to be tested.

---

# Performance

Optimize only after measuring.

Correctness comes before optimization.

Readability comes before micro-optimizations.

---

# Dependencies

Every dependency should solve a real problem.

Before installing a library ask:

Can we build this simply ourselves?

Avoid dependency bloat.

---

# Git Standards

Small commits.

Meaningful commit messages.

Prefer:

```
feat(inventory): implement inventory transaction service

fix(invoice): prevent negative stock

refactor(payment): simplify allocation logic
```

Avoid:

```
update

fix stuff

changes
```

---

# Documentation

Every major architectural decision should be documented.

Update documentation when behavior changes.

Documentation is part of the codebase.

---

# AI Coding Guidelines

AI assistants should follow these principles.

Never generate placeholder code.

Never ignore existing architecture.

Prefer improving existing code over rewriting it.

Always follow the Business Rules document.

Always follow the Domain Model.

Do not introduce new terminology without updating the Glossary.

When uncertain:

Ask questions instead of making assumptions.

---

# Code Review Checklist

Before considering code complete, ask:

* Is the business rule correct?
* Is the code easy to read?
* Is the naming clear?
* Is validation present?
* Is error handling sufficient?
* Is business logic separated from UI?
* Is duplication avoided?
* Are types correct?
* Does the implementation follow the documented architecture?

If the answer to any of these is "No", revise the implementation.

---

# Final Principle

Good code is not measured by how clever it is.

Good code is measured by how confidently another developer can modify it six months later.

Every line of code should make WBOS easier to understand, easier to maintain, and easier to extend.
