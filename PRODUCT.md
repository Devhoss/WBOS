# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Small family business team (2–5 people) in a Kuwait-based wholesale snack import operation. Everyone wears multiple hats — owner, warehouse, sales, and accounting roles overlap. The same people who receive goods also create invoices and review reports. No dedicated IT staff.

## Product Purpose

WBOS (Wholesale Business Operating System) replaces disconnected Excel spreadsheets and manual processes with a single, reliable source of truth for every operational workflow — from purchasing inventory to receiving customer payments. Success means the business naturally prefers using WBOS over spreadsheets for daily operations.

## Positioning

A self-hosted, workflow-driven operating system built by wholesalers for wholesalers. Unlike generic inventory apps or enterprise ERPs, WBOS is designed around the actual import wholesale cycle (Supplier → PO → Shipment → Receiving → Inventory → Sales → Invoices → Payments → Reporting) rather than isolated CRUD screens. Every action creates auditable transactions; inventory is never edited directly.

## Operating Context

Primary workflow is a continuous import cycle:

1. Supplier relationship and purchasing
2. Purchase Orders to suppliers
3. Import Shipments (with document tracking — invoices, packing lists, bills of lading)
4. Warehouse Receiving (GRN with automatic inventory posting)
5. Inventory management (FIFO costing, lot tracking, multi-warehouse)
6. Customer orders and sales
7. Invoicing with credit notes
8. Payment recording and allocation
9. Reporting and business insights

The business deals in KWD (Kuwaiti Dinar) as primary currency, with USD and EUR support. Products are imported snacks distributed wholesale. Inventory integrity is paramount — every stock movement creates an immutable transaction.

## Capabilities and Constraints

**Implemented:**
- Dashboard with real-time KPIs (daily sales, monthly revenue, receivables, inventory value, low stock, overdue customers)
- Full inventory management with transaction ledger, lot tracking, multi-warehouse
- Product catalog with SKU, barcode, categories, units of measure
- Supplier management with purchasing history
- Customer management with credit limits and outstanding balances
- Purchase orders with partial receiving and GRN
- Import shipment tracking with typed document attachments
- Sales invoices with credit notes
- Payment recording with multi-invoice allocation
- Quotations (pre-sales)
- Customer returns and supplier returns
- Reports (sales, inventory valuation, gross profit, purchasing)
- Activity logging and audit trail
- Backup and restore with versioned packages
- Print-friendly layouts (A4)
- Dark mode support
- Responsive sidebar navigation (collapsible)
- Authentication via better-auth
- Docker deployment

**Constraints:**
- Self-hosted; no cloud SaaS offering yet
- English-only interface (Arabic fonts loaded but UI not localized)
- Single-tenant (organization-per-deployment model)
- Inventory quantities are never edited directly — only via transactions
- Financial values use decimal precision (never floating-point)
- History must never be lost — archive over delete

**Undecided / Future:**
- Multi-warehouse lot hierarchy (Zone → Aisle → Shelf → Bin)
- FIFO costing at lot level
- Barcode scanning
- Mobile warehouse workflows
- AI-powered insights and demand forecasting
- Multi-company and multi-tenant SaaS
- Public APIs and plugin architecture

## Brand Commitments

- **Name:** WBOS (Wholesale Business Operating System)
- **Logo:** Teal geometric crystal/gem icon on dark navy rounded square background. Teal gradient from #0EA894 to #0C8A79. Background #0B111B.
- **Primary color:** Teal (HSL 173 73% 31% light / 172 66% 42% dark)
- **Destructive color:** Red (HSL 0 72% 45% light / 0 68% 52% dark)
- **Typography:** Inter as primary sans-serif; Noto Sans Arabic loaded for future localization
- **Theme:** Light and dark mode supported via next-themes with system preference detection
- **Border radius:** 8px lg, 6px md, 4px sm — rounded but not bubbly

## Evidence on Hand

- Extensive project documentation: PROJECT_BIBLE.md, glossary, business rules, workflows, 12 ADRs, coding standards, UI guidelines, accounting principles
- Demo seed data (`prisma/demo-seed.mjs`) with realistic wholesale product catalog
- Working application with all core modules implemented and functional
- Design tokens defined in CSS custom properties and Tailwind config
- Favicon, apple-touch-icon, and SVG logo in public/
- E2E tests for full import lifecycle
- Docker deployment configuration

## Product Principles

1. **Business First** — Business workflows always come before UI design. The software models how the business actually operates.
2. **Data Integrity Above Everything** — Business data must always be accurate. Convenience never compromises correctness. The database is the source of truth.
3. **History Must Never Be Lost** — Important business events are preserved permanently. Archive over delete. Correcting entries over modification.
4. **Simplicity Wins** — Choose the simplest solution that correctly solves the problem. Avoid building features "just in case."
5. **Workflow-Driven** — We build complete business processes, not isolated CRUD pages. Receiving a shipment automatically updates inventory, records transactions, preserves costing, and creates activity logs.
