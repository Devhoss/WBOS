# WBOS — Wholesale Business Operating System

> A modern, self-hosted business operating system for wholesale import and distribution companies.

---

## Vision

WBOS (Wholesale Business Operating System) is a business management platform built to replace spreadsheet-driven workflows with a reliable, scalable, and modern system.

The project began from a real business need.

Our wholesale snack import business relied heavily on Excel to manage:

* Inventory
* Purchase Orders
* Shipments
* Customers
* Suppliers
* Sales
* Payments
* Financial reporting

While spreadsheets offered flexibility, they became increasingly difficult to maintain as the business grew.

WBOS is designed to become the single source of truth for every operational workflow.

---

# Goals

WBOS is designed to be:

* Reliable
* Fast
* Self-hosted
* Maintainable
* Auditable
* Extensible
* AI-friendly

The long-term objective is to build software that can operate a wholesale business from purchasing inventory to receiving customer payments.

---

# Core Principles

The architecture of WBOS follows several guiding principles:

* Business-first design
* Domain-driven architecture
* Immutable business history
* Transaction-based inventory
* FIFO inventory costing
* Strong financial integrity
* Multi-tenant ready
* Docker-first deployment
* AI-assisted development

Every architectural decision supports these principles.

---

# Features

## Inventory Management

* Products
* Categories
* Warehouses
* Inventory Lots
* Inventory Ledger
* FIFO Costing
* Inventory Adjustments
* Stock Transfers
* Physical Inventory Counts

---

## Purchasing

* Suppliers
* Purchase Orders
* Partial Receiving
* Shipments
* Inventory Receiving
* Supplier History

---

## Sales

* Customers
* Sales Invoices
* Credit Notes
* Customer Statements
* Outstanding Balances

---

## Payments

* Partial Payments
* Payment Allocation
* Customer Balances
* Financial History

---

## Reporting

* Sales Reports
* Inventory Valuation
* Gross Profit
* Purchasing Reports
* Customer Reports
* Supplier Reports
* Dashboard Analytics

---

## Future Features

* Barcode Scanning
* Mobile Warehouse Mode
* AI Purchasing Assistant
* Demand Forecasting
* Public API
* Third-Party Integrations
* Plugin System

---

# Technology Stack

## Frontend

* Next.js (App Router)
* React
* TypeScript
* Tailwind CSS
* shadcn/ui

---

## Backend

* Next.js Server Actions
* Route Handlers
* Application Services
* Repository Pattern

---

## Database

* PostgreSQL
* Prisma ORM

---

## Authentication

* Better Auth

---

## Deployment

* Docker
* Docker Compose
* Self-hosted

---

# Architecture

WBOS follows a Modular Monolith architecture.

```text
Browser
    │
    ▼
React Components
    │
    ▼
Server Actions / Route Handlers
    │
    ▼
Application Services
    │
    ▼
Repositories
    │
    ▼
Prisma
    │
    ▼
PostgreSQL
```

Business logic is isolated from the UI.

Database access is isolated from business logic.

Every layer has a single responsibility.

---

# Project Structure

```text
docs/
├── adr/
├── PROJECT_BIBLE.md
├── business-rules.md
├── workflows.md
├── database.md
├── domain-model.md
├── glossary.md
├── architecture.md
├── coding-standards.md
├── ui-guidelines.md
├── roadmap.md
├── accounting-principles.md

src/
├── app/
├── domains/
├── shared/
├── infrastructure/
└── lib/
```

---

# Documentation

The documentation is organized into several sections.

## Business

Defines how the business operates.

* Project Bible
* Business Rules
* Workflows
* Domain Model
* Database
* Accounting Principles
* Glossary

---

## Engineering

Defines how the software is built.

* Architecture
* Coding Standards
* UI Guidelines
* Roadmap
* Development Setup

---

## Architecture Decision Records

Documents every significant architectural decision.

Examples include:

* Modular Monolith
* Multi-Tenant Architecture
* Transaction-Based Inventory
* FIFO Inventory Lots
* PostgreSQL + Prisma
* Better Auth
* Server Actions
* Domain-Driven Architecture
* Financial Model

---

# Development Philosophy

WBOS is developed incrementally.

The priorities are:

1. Correctness
2. Simplicity
3. Maintainability
4. Business Value

Features are only considered complete when they support real business workflows.

---

# Roadmap

The project is divided into incremental phases.

* Phase 0 — Planning & Architecture
* Phase 1 — Foundation
* Phase 2 — Master Data
* Phase 3 — Inventory
* Phase 4 — Purchasing
* Phase 5 — Sales & Payments
* Phase 6 — Reporting
* Phase 7 — Productivity
* Phase 8 — Intelligence
* Phase 9 — Platform Expansion

Each phase leaves the application in a deployable and usable state.

---

# Development Status

**Current Phase:** Phase 1 — Foundation closeout

The infrastructure and database foundation is complete.

The remaining closeout work is application-level authentication, onboarding, protected route verification, and setup documentation before Phase 2 master data begins.

---

# Design Philosophy

WBOS is productivity software.

The interface should help users complete work quickly and confidently.

The application draws inspiration from:

* Linear
* Stripe Dashboard
* GitHub
* Vercel
* Notion

The focus is on clarity, consistency, and efficiency rather than visual effects.

---

# Why WBOS Exists

Most small and medium wholesale businesses begin with spreadsheets.

Over time, spreadsheets become:

* Difficult to maintain
* Difficult to audit
* Difficult to scale
* Prone to human error

WBOS exists to replace disconnected spreadsheets with a single, reliable operating system that models how the business actually works.

The software is being built from real operational experience rather than hypothetical requirements.

---

# Contributing

WBOS follows documented engineering standards.

Before contributing, please read:

* `docs/coding-standards.md`
* `docs/architecture.md`
* `docs/domain-model.md`
* `docs/business-rules.md`

Consistency is valued over personal preference.

Every significant architectural decision should be documented through an Architecture Decision Record (ADR).

---

# License

This project is currently private.

Licensing terms will be determined if the project is released publicly.

---

# Final Thoughts

WBOS is more than an inventory system.

It is an attempt to build software that accurately represents how a wholesale business operates while remaining simple enough to maintain for many years.

The project prioritizes thoughtful architecture over rapid feature development, believing that strong foundations ultimately produce better software.

> **Build the right software before building more software.**
