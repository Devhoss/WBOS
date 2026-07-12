# Development Setup

> Local setup instructions for WBOS development.

---

# Prerequisites

* Node.js 24+
* npm
* PostgreSQL 17
* A configured `.env` file

WBOS currently uses a PostgreSQL 17 database running on the development homelab server.

---

# Environment

Create `.env` from `.env.example` and configure:

```env
DATABASE_URL="postgresql://wbos:<password>@192.168.100.36:5432/wbos?schema=public"
BETTER_AUTH_SECRET="<generated-secret>"
BETTER_AUTH_URL="http://localhost:3000"
NEXT_PUBLIC_BETTER_AUTH_URL="http://localhost:3000"
WBOS_STORAGE_ROOT="./storage"
```

Do not commit real secrets.

---

# First Run

Install dependencies:

```bash
npm install
```

Generate Prisma Client:

```bash
npm run db:generate
```

Apply migrations:

```bash
npm run db:migrate
```

Start the application:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

---

# Authentication And Onboarding

Create users through the WBOS sign-up screen.

After sign-up, WBOS automatically creates:

* Organization
* Owner OrganizationMembership
* BusinessSettings
* Default DocumentSequence records
* ActivityLog entry

Better Auth owns user creation, password hashing, sessions, and sign-out.

WBOS owns organization onboarding, tenant resolution, authorization, and business services.

---

# Database Reset & Seeding

## Quick Start (all-in-one)

```bash
npm run db:fresh
```

This wipes the database, re-runs all migrations, bootstraps the organization (warehouses, units, categories, settings), then loads deterministic demo data (suppliers, customers, products, orders, invoices, payments).

After `db:fresh`, start the app:

```bash
npm run dev
```

Then sign up at `http://localhost:3000/sign-up`. The first account automatically becomes the OWNER of the pre-seeded organization with all demo data immediately available.

---

## Individual Commands

| Command | Description |
|---|---|
| `npm run db:fresh` | Full reset: migrate reset → bootstrap seed → demo seed (one command) |
| `npm run db:reset` | `prisma migrate reset --force` — drops DB, re-runs migrations + bootstrap seed only |
| `npm run db:demo` | Re-run demo data seed only (idempotent — safe to run multiple times) |
| `npm run db:seed` | Bootstrap seed only (organization, warehouses, units, categories, settings) |

---

## How The Bootstrap Works

`prisma/seed.mjs` creates a bootstrap organization with:

- Fixed ID `bootstrap-org-001` (deterministic, idempotent — skipped if already exists)
- Business settings (bilingual name, address, VAT, CR, footer, terms)
- 2 warehouses: Main Warehouse, Cold Storage
- 3 units of measure: Piece (PC), Carton (CTN), Case (CS)
- 6 product categories
- 5 adjustment reasons
- 9 document sequences (PO, GRN, SO, SHP, INV, PAY, CN, ADJ, WT)
- If any Better Auth user exists, attaches the first one as OWNER

**No user is required** — the bootstrap runs independently of authentication. If no users exist yet, the first signup is automatically attached via `OnboardingService.completeFirstOrganization()`.

---

## How The Demo Seed Works

`prisma/demo-seed.mjs` populates fully realized business data:

- 5 suppliers with contact details
- 6 customers with credit limits
- 14 products across 6 categories with SKUs, prices, pieces-per-box
- 5 purchase orders (4 fully received + inventoried, 1 approved awaiting delivery)
- 5 sales orders with complete lifecycles:
  - SO-001 (Al Jazeera): **INVOICED**, 0 paid, shipment out-for-delivery
  - SO-002 (Al Muthanna): **PAID** in full via cash
  - SO-003 (Ahmed's Mini Mart): **ISSUED**, 0 paid
  - SO-004 (Family Care Co-op): **PARTIALLY_PAID** (124.325 / 224.325 KWD)
  - SO-005 (Al Salam Catering): **ISSUED**, 0 paid
- Inventory ledger: all GRNs post PURCHASE_RECEIPT IN, all deliveries post SALE OUT
- Document sequences updated to match (next PO = 6, next SO = 6, next INV = 6, etc.)

All IDs are deterministic — every run produces identical data, balances, and invoice numbers.

---

## Useful Commands

```bash
npm run dev
npm run build
npm run typecheck
npm run lint
npm run db:generate
npm run db:migrate
npm run db:fresh
npm run db:reset
npm run db:demo
npm run db:studio
```

---

## Windows: Prisma Engine Lock

On Windows, the `query_engine-windows.dll` file can be locked by a running Node.js process, causing `prisma migrate reset` to fail with a `EBUSY` error.

**If `npm run db:fresh` or `npm run db:reset` fails with a file lock error:**

```bash
# 1. Stop the dev server (Ctrl+C in the terminal where it's running)
# 2. Kill any lingering Node processes that hold Prisma open:
taskkill /F /IM node.exe
# 3. Retry:
npm run db:fresh
```

**To avoid the lock in the first place:**

Always stop `npm run dev` before running any Prisma CLI command (`db:migrate`, `db:reset`, `db:fresh`, `db:studio`). The Next.js dev server holds an active Prisma client connection that locks the engine binary on Windows.

This is a known Windows limitation with Prisma's native query engine binary — it does not occur on macOS or Linux.

---

# Architecture Boundaries

Authentication:

* Better Auth
* `src/infrastructure/auth`

Tenant resolution:

* `src/infrastructure/tenancy`
* `src/infrastructure/request`

Authorization:

* `src/infrastructure/authorization`

Business services:

* `src/domains/*/services`

Pages and server actions should consume these services rather than duplicating session, tenant, or permission logic.
