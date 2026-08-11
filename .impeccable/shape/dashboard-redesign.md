# Dashboard Redesign Report — WBOS Command Center

**Date:** 2026-08-09
**Target:** `src/app/page.tsx`, `src/app/simple-bar-chart.tsx`, `src/app/dashboard-service.ts`
**Scope:** Dashboard information hierarchy, data visualization, and visual design

---

## Design Direction

Transformed the dashboard from a flat, visually monotonous layout into a layered three-tier information hierarchy that feels like a wholesale operations command center. Preserved all WBOS identity constraints: teal accent, border-driven structure, flat-by-default surfaces, Inter typography, dense information architecture.

---

## Changes Applied

### 1. Hero Metrics — critical financial KPIs (replaces Operations + Financial + Customers sections)

**Before:** Three separate section headings ("Operations", "Financial", "Customers") with 8 identical gray KPI cards. No visual hierarchy — all cards looked the same.

**After:** Single unified row of 4 hero metrics with teal left-border accent:
- **Sales This Month** — value + today's sales subtitle
- **Outstanding Receivables** — value + unpaid invoice count subtitle
- **Inventory Value** — teal emphasis treatment + "FIFO" badge + active product count
- **Overdue Customers** — count with destructive color when > 0, "need attention" / "all clear" subtitle

Each card uses `border-l-[3px] border-l-primary` for visual distinction. The Inventory Value card retains its emphasis variant with `border-primary/40` and teal text. The Overdue Customers card dynamically uses destructive color when there are overdue accounts.

### 2. Pipeline Status — order and shipment health (new section, replaces Operations KPI cards)

**Before:** Generic KPI cards showing just counts (Open POs: 3, Pending Shipments: 2). No visibility into status distributions.

**After:** Three pipeline cards showing status distributions with inline progress bars:
- **Sales Orders** — DRAFT/PENDING_APPROVAL/APPROVED/READY_FOR_INVOICE/INVOICED/PAID/CANCELLED
- **Purchase Orders** — DRAFT/PENDING_APPROVAL/APPROVED/PARTIALLY_RECEIVED/FULLY_RECEIVED/CANCELLED
- **Shipments** — PENDING_PICK/PICKING/PICKED/LOADED/OUT_FOR_DELIVERY/DELIVERED/FAILED/CANCELLED

Each status has a semantic color dot and horizontal progress bar showing proportion of total. Cards link to their respective list pages.

### 3. Enhanced SVG charts

**Before:** Gray bars (`fill-primary/80`), value labels hidden when bar < 20px tall, no average reference, no percentage context.

**After:**
- **TrendChart:** Full-opacity teal bars (`fill-primary`), dashed average line with "avg" annotation, value labels always visible (using `formatKwdShort` for compact display: "12.5K", "1.2M")
- **TopItemsChart:** Full-opacity teal bars, dual-line labels showing value and percentage of total

### 4. Activity feed improvements

- Most recent activity item gets a teal dot indicator (`text-primary`) instead of gray
- All other items remain `text-muted-foreground`

### 5. Data service additions (`dashboard-service.ts`)

**New types:**
- `StatusCount` — `{ status: string; count: number }`
- `PipelineStatus` — `{ salesOrders: StatusCount[], purchaseOrders: StatusCount[], shipments: StatusCount[] }`
- `UnpaidInvoiceSummary` — `{ totalOutstanding: number; count: number }`

**New methods:**
- `getPipelineStatus(organizationId)` — uses `prisma.groupBy` on SalesOrder, PurchaseOrder, and Shipment to get status distributions. Parallel queries, index-driven.
- `getUnpaidInvoiceSummary(organizationId)` — uses `prisma.invoice.aggregate` to get total outstanding and count. (Not yet used in UI but available for future enhancements.)

---

## Layout Structure

```
Dashboard
├── Header (unchanged)
├── OnboardingPanel (conditional, unchanged)
├── Hero Metrics (4 cards, teal left border)
│   ├── Sales This Month (value + today subtitle)
│   ├── Outstanding Receivables (value + invoice count subtitle)
│   ├── Inventory Value (teal emphasis, FIFO badge)
│   └── Overdue Customers (destructive when > 0)
├── Pipeline Status (3 cards with status bars)
│   ├── Sales Orders (status distribution)
│   ├── Purchase Orders (status distribution)
│   └── Shipments (status distribution)
├── Charts (2 columns, enhanced)
│   ├── Sales Trend (teal bars, average line, compact labels)
│   └── Top Products (teal bars, percentage labels)
└── Activity & Details (3 columns)
    ├── Recent Activity (2 cols, teal dot for latest)
    ├── Top Customers (1 col)
    └── Unpaid Invoices (1 col, unchanged)
```

---

## Color Strategy

| Element | Treatment |
|---------|-----------|
| Hero metric left borders | `border-l-primary` (teal) |
| Inventory Value emphasis | `border-primary/40`, `text-primary` |
| Overdue Customers (when > 0) | `border-l-destructive`, `text-destructive` |
| Chart bars | `fill-primary` (full opacity teal) |
| Pipeline status dots | Semantic colors (blue/orange/green/red) per status |
| Activity dot (most recent) | `text-primary` (teal) |
| Average line | `stroke-muted-foreground/40` dashed |

---

## Verification

| Check | Result |
|---|---|
| TypeScript (`tsc --noEmit`) | ✅ 0 errors |
| ESLint | ✅ 0 errors, 0 warnings |
| Vitest | ✅ 198/213 pass (15 pre-existing backup-service Windows tar failures) |
| Design system compliance | ✅ No gradients, no glassmorphism, no excessive shadows, flat-by-default preserved |
| Responsive | ✅ Grid collapses: `sm:grid-cols-2` → stacked on mobile |
| Accessibility | ✅ All interactive elements have `focus-visible:ring`, `aria-label` on charts |
| Links | ✅ All KPI/pipeline cards link to existing report/list pages |

---

## Summary

| Aspect | Before | After |
|--------|--------|-------|
| Visual tiers | 1 (flat) | 3 (hero → pipeline → charts) |
| Color accents | Gray everywhere | Teal borders, semantic status colors, destructive alerts |
| Information density | Sparse (single-card sections) | Dense (4 hero + 3 pipeline in 2 rows) |
| Status visibility | Just counts | Full status distributions with progress bars |
| Chart quality | Gray bars, hidden labels | Teal bars, average line, percentages, compact labels |
| Section headings | 3 separate headings | 0 (cards are self-evident) |
| Unused data | SalesOrder/PurchaseOrder/Shipment statuses ignored | Status distributions visualized |
