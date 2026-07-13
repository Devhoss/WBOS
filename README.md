# WBOS — Wholesale Business Operating System

> A modern, self-hosted business operating system for wholesale import and distribution companies. Replaces spreadsheet-driven workflows with a reliable, auditable, all-in-one platform.

---

## Table of Contents

- [Vision](#vision)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Architecture](#architecture)
- [Screenshots](#screenshots)
- [Hosting / Deployment](#hosting--deployment)
  - [Production Architecture](#production-architecture)
  - [Quick Start (Docker Compose)](#quick-start-docker-compose)
  - [Updating](#updating)
  - [Environment Variables](#environment-variables)
  - [Database](#database)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Status](#development-status)
- [Design Philosophy](#design-philosophy)
- [Why WBOS Exists](#why-wbos-exists)
- [Contributing](#contributing)
- [License](#license)

---

## Vision

WBOS was born from a real business need. Our wholesale snack import business relied heavily on Excel (and eventually Odoo) to manage inventory, purchase orders, shipments, customers, suppliers, sales, payments, and financial reporting. Spreadsheets offered flexibility but became increasingly difficult to maintain, audit, and scale as the business grew.

WBOS is the single source of truth for every operational workflow — from purchasing inventory to receiving customer payments.

---

## Features

### Inventory Management
- Products with SKU, barcode, categories, and unit of measure tracking
- Multi-warehouse support with per-warehouse stock levels
- FIFO inventory costing with lot-level tracking
- Immutable inventory ledger — every stock movement is recorded and cannot be altered
- Stock adjustments, warehouse transfers, and cycle counts
- Low stock alerts and inventory valuation

### Purchasing
- Supplier management with contact details and history
- Purchase orders with partial receiving support
- Goods receipt notes (GRN) with automatic inventory posting
- Receiving against POs or manual (ad-hoc) receiving
- Approval workflow (self-approval or dual approval)

### Sales
- Customer management with credit limits and outstanding balances
- Sales orders with line-item pricing from product catalog
- Sales invoices with credit notes
- Customer statements and aging reports
- Partial payment allocation across invoices

### Payments
- Payment recording with allocation to specific invoices
- Payment history per customer and invoice
- Outstanding balance tracking

### Operational Dashboard
- Real-time KPIs: today's sales, monthly revenue, outstanding receivables, inventory value, low stock items, overdue customers
- Monthly sales trend chart
- Top products and top customers charts
- Recent activity feed
- Unpaid invoices summary

### Reporting
- Sales reports
- Inventory valuation reports
- Gross profit analysis
- Purchasing reports
- Customer and supplier reports

### Onboarding & UX
- Guided first-run setup wizard (warehouses → products → customers → suppliers → orders)
- Dismissible onboarding card that collapses into a compact progress banner
- Welcome dashboard with quick-action buttons for empty organizations
- Responsive sidebar with desktop collapsible (Ctrl+B) and mobile slide-over drawer
- Dark mode support
- Production-ready error boundaries on all forms

### Production Polish (recently completed)
- Print-ready invoice layout with `window.open()` navigation
- Server-side PDF generation via Playwright in Docker
- Auth session handling fixed — API routes pass request headers directly
- All client-side `crypto.randomUUID()` replaced with a universal `uid()` fallback for compatibility
- Health endpoints switched from raw SQL (`SELECT id FROM "Organization"`) to Prisma ORM — zero `prisma:error` on build
- Complete favicon set (`favicon.ico`, SVG, 16×16, 32×32, Apple Touch Icon, `site.webmanifest`)
- Logo upload fixed with cache-busting and image-load error fallback
- Empty states across all list pages

---

## Technology Stack

### Frontend
- **Next.js 15** (App Router)
- **React 19**
- **TypeScript**
- **Tailwind CSS 4**
- **shadcn/ui** components

### Backend
- **Next.js Server Actions** — form mutations
- **Route Handlers** — API endpoints (PDF generation, health checks)
- **Application Services** — business logic layer
- **Repository Pattern** — database access abstraction

### Database
- **PostgreSQL 17**
- **Prisma ORM** with migrations

### Authentication
- **Better Auth** with email/password, session management, and organization-level multi-tenancy

### Deployment
- **Docker** with `output: "standalone"` for self-hosting
- **Docker Compose** — single-command deployment
- **GitHub Container Registry (GHCR)** — container image distribution

---

## Architecture

WBOS follows a **Modular Monolith** architecture with domain-driven structure.

```text
Browser
    │
    ▼
React Components (Server + Client)
    │
    ▼
Server Actions / Route Handlers
    │
    ▼
Application Services  ──►  Domain Logic
    │
    ▼
Repositories  ──►  Prisma ORM  ──►  PostgreSQL
```

Key architectural decisions:
- **Immutable business history** — inventory ledger entries, once written, are never modified
- **Transaction-based inventory** — every stock movement is a double-entry ledger transaction
- **FIFO inventory costing** — cost layers tracked per lot, consumed in order of receipt
- **Multi-tenant** — all data scoped to `organizationId` via authenticated request context
- **Column-level encryption** — sensitive fields (VAT numbers, financial data) encrypted at rest

---

## Hosting / Deployment

### Production Architecture

```
GitHub ──► GitHub Container Registry (GHCR)
              │
              ▼
         Homelab Server
              │
              ▼
    Docker Compose (wbos + postgres)
              │
              ▼
         Port 3005 → Container 3000
```

Images are built via GitHub Actions, pushed to `ghcr.io/devhoss/wbos:latest`, and pulled onto the server.

### Quick Start (Docker Compose)

```yaml
services:
  wbos:
    image: ghcr.io/devhoss/wbos:latest
    ports:
      - "3005:3000"
    environment:
      DATABASE_URL: "postgresql://user:password@db:5432/wbos"
      BETTER_AUTH_URL: "https://wbos.yourdomain.com"
      INTERNAL_APP_URL: "http://127.0.0.1:3000"
      BETTER_AUTH_SECRET: "<generate-a-secret>"
      BETTER_AUTH_TRUSTED_ORIGINS: "http://localhost:3000"
      WBOS_STORAGE_ROOT: "/app/storage"
    volumes:
      - ./storage:/app/storage
      - ./backups:/app/backups
    depends_on:
      - db
    restart: unless-stopped

  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_DB: wbos
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
    volumes:
      - pgdata:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  pgdata:
```

### First Deployment

1. **Create storage directories** with the correct UID (the app runs as UID 1001):

   ```bash
   mkdir -p storage backups
   sudo chown -R 1001:1001 storage backups
   sudo chmod -R 775 storage backups
   ```

2. Copy the snippet above into a `docker-compose.yml` file.

3. Replace `BETTER_AUTH_SECRET` with a random string (run `openssl rand -hex 32`).

4. Replace the database credentials and domain.

5. Start the stack:

   ```bash
   docker compose up -d
   ```

   On first start, the entrypoint script automatically:
   - Validates storage directories exist and are writable
   - Runs database migrations
   - Starts the application server

6. Visit `https://wbos.yourdomain.com`, sign up, and complete the onboarding wizard.

### Updating

```bash
git pull                       # if using a local checkout
docker compose pull            # pull the latest GHCR image
docker compose up -d           # recreate containers
```

The database schema is automatically migrated on container start via the entrypoint script.

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `BETTER_AUTH_URL` | Yes | Public URL (must match what users type in the browser, e.g. `https://wbos.example.com`) |
| `BETTER_AUTH_SECRET` | Yes | Secret key for session encryption |
| `BETTER_AUTH_TRUSTED_ORIGINS` | No | Comma-separated list of additional origins to trust (for reverse proxy or development) |
| `INTERNAL_APP_URL` | No | Internal URL for Playwright PDF generation (default: `http://127.0.0.1:3000`) |
| `WBOS_STORAGE_ROOT` | No | Directory for uploaded files (default: `<cwd>/public`). Must be a persisted Docker volume. |

### Reverse Proxy (Nginx Proxy Manager)

If using Nginx Proxy Manager (or similar) in front of the Docker container:

1. **Set `BETTER_AUTH_URL`** to the public HTTPS URL (e.g. `https://wbos.home.lab`).
2. **Forwarded headers** — ensure NPM passes these to the backend:
   - `X-Forwarded-Proto: https`
   - `X-Forwarded-Host: wbos.home.lab`
   - `X-Forwarded-For` (your client IP)
3. **Trusted origins** — add any development or internal URLs to `BETTER_AUTH_TRUSTED_ORIGINS`:
   ```
   BETTER_AUTH_TRUSTED_ORIGINS=http://localhost:3000,http://192.168.100.36:3000
   ```
4. **WebSocket support** (optional, for hot reload) — enable WebSocket passthrough in NPM.

### Storage Persistence

Uploaded files (organization logos) are stored in `WBOS_STORAGE_ROOT/uploads/`. Mount a Docker volume to persist uploads across container restarts:

```yaml
volumes:
  - ./storage:/app/storage
  - ./backups:/app/backups
```

On first deployment, ensure the directories exist and have correct permissions:

```bash
mkdir -p storage backups
sudo chown -R 1001:1001 storage backups
sudo chmod -R 775 storage backups
```

The container runs a storage validation check on startup. If permissions are incorrect, the container will fail immediately with a clear error message and instructions. Run `docker compose logs app` to see the validation output.

### Health Check Endpoint

The application exposes a health check at `/api/health`:

```bash
curl http://localhost:3000/api/health
```

Response:
```json
{
  "healthy": true,
  "app": { "uptime": 42, "status": "running" },
  "database": { "ok": true, "latency": "2ms" },
  "prisma": { "ok": true, "latency": "1ms", "organizationExists": true },
  "storage": { "root": "/app/storage", "exists": true, "writable": true, "uploads": true, "backups": true },
  "environment": "production"
}
```

The health check validates:
- Database connectivity (`SELECT 1`)
- Prisma ORM initialization
- Storage root exists and is writable
- Required subdirectories exist (uploads, backups)

The Docker `HEALTHCHECK` polls this endpoint every 30 seconds.

### Database

WBOS uses **PostgreSQL 17**. The schema is managed through Prisma migrations:

```bash
# Apply migrations
npx prisma migrate deploy

# Seed demo data (optional)
node prisma/seed.mjs
```

The Docker entrypoint runs `npx prisma migrate deploy` automatically before starting the Next.js server.

---

## Development Setup

### Prerequisites

- **Node.js 22+**
- **PostgreSQL 17** (local or Docker)
- **pnpm** (recommended) or npm

### Steps

```bash
# 1. Clone the repository
git clone <repo-url>
cd wbos

# 2. Install dependencies
pnpm install

# 3. Copy environment variables
cp .env.example .env
# Edit .env with your database credentials

# 4. Run database migrations
npx prisma migrate deploy

# 5. Seed demo data (optional)
node prisma/seed.mjs

# 6. Start the dev server
pnpm dev
```

Visit `http://localhost:3000`.

### Useful Commands

```bash
pnpm dev          # Start development server
pnpm build        # Production build
pnpm test         # Run tests (Vitest)
pnpm lint         # Run linter (ESLint / Biome)
npx prisma studio # Database GUI (port 5555)
```

---

## Project Structure

```
docs/
├── adr/                    # Architecture Decision Records
├── PROJECT_BIBLE.md        # Complete project specification
├── business-rules.md
├── workflows.md
├── domain-model.md
├── database.md
├── architecture.md
├── coding-standards.md
└── roadmap.md

src/
├── app/                    # Next.js App Router pages + API routes
│   ├── sales/
│   ├── purchasing/
│   ├── inventory/
│   ├── invoices/
│   ├── reports/
│   ├── customers/
│   ├── suppliers/
│   ├── warehouses/
│   ├── settings/
│   ├── onboarding/
│   └── api/
├── components/             # Shared React components
│   ├── ui/                 # shadcn/ui primitives
│   ├── sidebar.tsx
│   ├── app-shell.tsx
│   ├── org-branding.tsx
│   ├── onboarding-panel.tsx
│   ├── empty-state.tsx
│   └── ...
├── domains/                # Business domains (DDD)
│   ├── sales/
│   ├── purchasing/
│   ├── inventory/
│   ├── customers/
│   ├── suppliers/
│   ├── warehouses/
│   └── settings/
├── shared/                 # Shared utilities & errors
├── infrastructure/         # Framework concerns (auth, DB, request context)
└── lib/                    # General utilities
```

---

## Development Status

**Status:** Production-ready for single-organization deployments.

Completed modules:
- ✅ Authentication & authorization (Better Auth, RBAC: Owner/Admin/Manager/Staff)
- ✅ Organization onboarding & multi-tenancy
- ✅ Master data: products, customers, suppliers, warehouses, categories, units of measure
- ✅ Inventory management: stock ledger, transfers, adjustments, cycle counts, FIFO costing
- ✅ Purchasing: purchase orders, goods receipt, partial receiving, approval workflow
- ✅ Sales: sales orders, invoices, credit notes, customer statements
- ✅ Payments: payment allocation, outstanding balance tracking
- ✅ Reporting: dashboard analytics, sales/inventory/purchasing reports
- ✅ Operational dashboard with KPIs, charts, and activity feed
- ✅ Print-layout invoices with server-side PDF generation
- ✅ Responsive layout with mobile navigation
- ✅ Production polish: error boundaries, empty states, onboarding UX, favicon set
- ✅ Docker self-hosting with automated DB migrations

Planned:
- Barcode scanning
- Mobile warehouse mode (PWA)
- AI purchasing assistant & demand forecasting
- Public REST API
- Third-party integrations & plugin system

---

## Design Philosophy

WBOS is productivity software. The interface is designed to help users complete work quickly and confidently.

Design inspiration:
- **Linear** — clean, fast task management
- **Stripe Dashboard** — data density with clarity
- **GitHub** — familiar navigation patterns
- **Vercel** — modern, minimal admin UI
- **Notion** — flexible content organization

Focus areas:
- Clarity over visual effects
- Consistency across all modules
- Efficiency for frequent actions
- Keyboard shortcuts where they add value (Ctrl+B for sidebar toggle)

---

## Why WBOS Exists

Most small and medium wholesale businesses begin with spreadsheets (or expensive, over-engineered ERPs). Over time, spreadsheets become difficult to maintain, audit, and scale.

WBOS exists to replace disconnected spreadsheets — and complex ERPs — with a single, reliable operating system that models how a wholesale business actually works. The software is built from real operational experience rather than hypothetical requirements.

> **Build the right software before building more software.**

---

## Contributing

Before contributing, please read the documentation in `docs/`:

- `docs/coding-standards.md` — code style, naming conventions, patterns
- `docs/architecture.md` — architectural overview and decisions
- `docs/domain-model.md` — domain entities and relationships
- `docs/business-rules.md` — core business logic rules

Every significant architectural decision should be documented through an Architecture Decision Record (ADR) in `docs/adr/`.

---

## License

This project is currently private. Licensing terms will be determined if the project is released publicly.
