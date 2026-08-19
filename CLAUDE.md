# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is WBOS

WBOS (Wholesale Business Operating System) is a self-hosted Next.js 16 dashboard for a Kuwait-based wholesale snack import business. It replaces spreadsheet-driven workflows with an auditable platform covering inventory (FIFO costing), purchasing, sales, invoicing, payments, and reporting. Currency is KWD (3 decimal places). The team is very small — this is not a full ERP.

## Commands

```bash
# Development
pnpm dev                    # Start dev server (http://localhost:3000)

# Build
pnpm build                  # prisma generate + next build

# Lint & Type Check
pnpm lint                   # ESLint (next core-web-vitals + typescript configs)
pnpm typecheck              # tsc --noEmit

# Tests
pnpm test                   # vitest run (all tests)
pnpx vitest run src/test/costing-service.test.ts   # Single test file
pnpx vitest run -t "test name"                      # Single test by name

# Database
pnpm db:migrate             # prisma migrate dev
pnpm db:generate            # prisma generate
pnpm db:studio              # Prisma Studio (port 5555)
pnpm db:seed                # Basic seed (node prisma/seed.mjs)
pnpm db:demo                # Demo seed with full sample data
pnpm db:fresh               # Reset + demo seed
pnpm db:integrity           # Read-only integrity report (exits non-zero on a violation)
```

## Architecture

**Modular monolith** with domain-driven structure. Next.js 16 App Router, React 19, Prisma ORM, PostgreSQL 17, Tailwind CSS 3, Better Auth.

### Request Lifecycle

```
Browser → Page/Component → Server Action or Route Handler → Application Service → Repository → Prisma → PostgreSQL
```

Business logic lives in services, never in UI components or pages.

### Directory Layout

```
src/
├── app/                    # Next.js App Router — pages, layouts, API routes
│   ├── reports/            # Report pages (executive, financial, inventory, etc.)
│   │   ├── components/     # Shared report components (KPI cards, tables, filters, export)
│   │   └── executive/      # Executive Summary dashboard
│   └── api/                # Route handlers (uploads, backups, health, /api/v1)
├── domains/                # Business domains — each owns services, repositories, types
│   ├── inventory/          # Stock ledger, FIFO costing, transfers, adjustments
│   ├── purchasing/         # POs, goods receipt, landed costs, allocation
│   ├── sales/              # Sales orders, invoices, payments, shipments
│   ├── reports/            # Report services (financial, inventory, purchasing, sales, operational)
│   └── ...                 # products, customers, suppliers, warehouses, etc.
├── infrastructure/         # Framework concerns
│   ├── auth/               # Better Auth setup
│   ├── database/           # Prisma client singleton
│   ├── request/            # AuthenticatedRequestContextService (org context resolution)
│   ├── tenancy/            # Tenant context
│   ├── storage/            # File storage providers
│   └── notifications/      # Firebase push notifications
├── components/             # Shared UI components (AppShell, sidebar, status-colors)
│   └── ui/                 # shadcn/ui primitives (dialog, confirm-dialog, reason-dialog)
├── shared/                 # Cross-domain utilities, error types
├── lib/                    # General utilities (cn, wholesale-terms)
└── test/                   # Vitest tests (mirrors domain structure)
```

### Key Patterns

**COGS classification:** `src/domains/reports/cogs-classification.ts` is the single source of truth for what counts as cost of goods sold. COGS is `SALE`/OUT minus `CUSTOMER_RETURN`/IN; `DAMAGE`, `EXPIRED` and `ADJUSTMENT_OUT` are inventory write-offs reported separately and never inside gross profit; `TRANSFER_OUT`/`TRANSFER_IN` are internal and excluded from both. The COGS report, the gross-profit detail report and the executive panel all import from it — never write a bespoke ledger WHERE clause in a report, or they will drift again as they previously did.

**Authorization:** Two roles only — `OWNER` and `MANAGER`. Use `requireManager()` for ordinary operational and business work, `requireOwner()` for irreversible/account-level work (deleting sales and purchase orders, backup download and restore), and `requireAnyRole()` for genuinely disjoint sets. There is deliberately **no** role ranking: never reintroduce a `hasMinimumRole`-style numeric comparison, and never gate an action with an ad-hoc `new Set([...]).has(context.role)`.

**Organization context:** All data is scoped to `organizationId`. Use `getCachedContext()` from `@/infrastructure/request/authenticated-request-context` in Server Components. In services/repositories that run in Server Actions, use `AuthenticatedRequestContextService.getCurrentContext(requestHeaders)`.

**Report services:** Extend `BaseReportRepository` (in `src/domains/reports/repositories/`) which provides `resolveOrganizationId()`, `buildDateFilter()`, and `toNumber()`. Report pages in `src/app/reports/` are Server Components that wrap content in `AppShell` + `ReportLayout` + `ErrorBoundary` + `Suspense`.

**Dashboard/Executive aggregation:** For dashboards that need direct Prisma aggregation (bypassing the repository layer for performance), follow the `DashboardService` pattern — direct `prisma.*` queries with the same WHERE filters as the domain services, accepting `organizationId` as a parameter.

**Proof of delivery:** Signed delivery paperwork is many photographed pages, and the set belongs to the **shipment**, not the sales order — an order shipped twice has two signatures covering two drops. Pages are `Attachment` rows with `attachmentType = PROOF_OF_DELIVERY` and `entityType = "SHIPMENT"`, ordered by `sortOrder`. Do **not** add a second document store: `/api/uploads/[...path]` already proves organization ownership for the `uploads/attachments/` subtree and answers 404 rather than 403 so it cannot be used to probe another tenant. `Attachment.contentHash` plus a partial unique index (live rows only) is what makes an upload retry idempotent — a phone that loses the reply re-sends identical bytes. `SalesOrder.signedInvoicePath` is retained for rows that already have one and surfaced separately as `legacySignedInvoicePath`; it is deliberately not backfilled, because those files sit outside the attachments subtree. See `docs/next-feature-proof-of-delivery.md`.

**Status badges:** Use `statusColorClass()` and `formatStatus()` from `@/components/status-colors`. Status values are UPPER_SNAKE_CASE enums (e.g., `FULLY_RECEIVED`, `PARTIALLY_PAID`).

**Decimal values:** All monetary/quantity columns use `Decimal(18, 3)` in Prisma. Convert with `Number(value)` when passing to components. Format KWD with `toLocaleString("en-KW", { minimumFractionDigits: 3, maximumFractionDigits: 3 })`.

### Component Conventions

- **Server Components by default.** Only add `"use client"` when interactivity is required (forms, dialogs, event handlers).
- **`AppShell`** wraps all authenticated pages. It resolves org context and redirects to `/sign-in` or `/onboarding` as needed.
- **`ReportLayout`** provides consistent report page structure (title, description, content area).
- **`ErrorBoundary`** + **`Suspense`** wrap data-fetching async components. Use the corresponding skeleton component as fallback.
- **KPI cards:** Use the pattern from `src/app/reports/components/kpi-card.tsx` — rounded-lg border, bg-background, icon with bg-primary/10, value + label.
- **Tables:** Use `src/app/reports/components/report-table.tsx` for consistent report tables.

### Design System

- **Teal primary accent:** `--primary: 173 73% 31%` (light) / `172 66% 42%` (dark). Use `bg-primary/10` for icon backgrounds, `text-primary` for emphasis.
- **Border-driven depth:** Cards use `rounded-lg border bg-background`. No shadows except for overlays (dialogs, dropdowns).
- **Dark mode:** Class-based (`darkMode: ["class"]`). All colors use HSL CSS custom properties.
- **Font:** Inter (body), Noto Sans Arabic / Noto Naskh Arabic (Arabic support).
- **Icons:** `lucide-react`. Consistent `className="size-5"` for card icons.
- **Status colors:** Centralized in `src/components/status-colors.ts`. Never hardcode status badge colors.

## Testing

- **Framework:** Vitest with `globals: true` (no need to import `describe`/`it`/`expect`).
- **Setup:** `src/test/setup.ts` mocks the Prisma client. Tests use `vi.mock("@/infrastructure/database/prisma")`.
- **Pattern:** Service tests mock Prisma models and test business logic in isolation. Import the service under test, call methods with mock data, assert outcomes.
- **Run single file:** `pnpx vitest run src/test/costing-service.test.ts`

## Known Limitations (do not expand scope to fix)

- `supplierPerformance()` falls back to `supplier.leadTimeDays` when no receipt history exists.
- E2E fixtures must not mutate demo data. `valuation-sync-e2e` asserts an absolute organisation-wide inventory value of 600.750, so any test that leaves value behind makes its `beforeAll` fail — and a failed `beforeAll` SKIPS the suite, which still reads as green in the summary line. Give a test its own product and warehouse, and tear them down with the shared tracker in `.e2e/fixtures.ts` (`createFixtureTracker()` + `afterAll(() => fixtures.cleanup())`) rather than hand-rolling the delete order — most of these relations are `onDelete: Restrict` and the ledger has to be unwound before the products it references.
- The `backup-service.test.ts` tests fail on Windows due to tar path resolution (`Cannot connect to C:`). This is a pre-existing environment issue, not a code bug.

## Documentation

Additional architecture and business documentation lives in `docs/`:
- `docs/architecture.md` — layered architecture, request lifecycle, domain structure
- `docs/coding-standards.md` — TypeScript, React, naming, file organization standards
- `docs/ui-guidelines.md` — design principles, layout, typography, component patterns
- `docs/business-rules.md` — core business logic rules
- `docs/domain-model.md` — entity relationships
- `docs/inventory-architecture.md` — FIFO costing, ledger, lot tracking
