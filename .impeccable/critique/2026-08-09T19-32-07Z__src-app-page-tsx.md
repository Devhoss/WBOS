---
target: src/app/page.tsx
total_score: 26
max_score: 36
na_heuristics: 9
p0_count: 0
p1_count: 2
p2_count: 2
timestamp: 2026-08-09T19-32-07Z
slug: src-app-page-tsx
---
# Dashboard Critique — WBOS Command Center (Post-Redesign)

**Method: dual-agent (A: design review · B: detector scan)**
**Date:** 2026-08-09
**Mode:** Operate (task-completion UI)
**Scope:** Dashboard page only (`src/app/page.tsx`, `simple-bar-chart.tsx`, `dashboard-service.ts`)

---

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Pipeline status bars and sales delta badge communicate well, but no "last updated" timestamp, no loading skeleton, no refresh mechanism — data can be stale without the user knowing |
| 2 | Match Between System and Real World | 4 | Wholesale terminology accurate throughout: KWD, FIFO, PO, SO, PENDING_PICK, PARTIALLY_RECEIVED. FIFO tooltip is well-written domain guidance |
| 3 | User Control and Freedom | 3 | Cards link to relevant pages. But: no date range selector, no drill-down from pipeline counts to filtered lists, no way to dismiss individual Action Needed items |
| 4 | Consistency and Standards | 4 | Excellent design-system adherence. Border-driven model consistently applied. Status badges centralized. Teal accent sparse and purposeful (~10-12% of surface) |
| 5 | Error Prevention | 2 | No loading skeleton on slow connections. No "last updated" indicator means stale data goes undetected. No proactive warning when data might be stale |
| 6 | Recognition Rather Than Recall | 3 | Pipeline status dots scannable. FIFO tooltip aids recognition. But: Action Needed mixes three entity types without sub-headers or summary count |
| 7 | Flexibility and Efficiency | 2 | No keyboard shortcuts beyond Ctrl+B sidebar toggle. No date range selector. No customizable layout. No interactive filtering on pipeline cards |
| 8 | Aesthetic and Minimalist Design | 3 | Clean three-tier hierarchy. Action Needed with destructive border is appropriately urgent. But: Unpaid Invoices panel is spatially disconnected from Outstanding Receivables hero card |
| 9 | Error Recovery | n/a | Read-only dashboard; no user-initiated errors to recover from |
| 10 | Help and Documentation | 2 | FIFO tooltip exists and is well-written. But: no help on pipeline status colors, no glossary for domain terms (GRN?), no "what does this dashboard show?" explainer |
| **Total** | | **26/36** | **Good** (72%) |

---

## Design Specificity Verdict

**Does it feel authored for this product, or category-interchangeable?**

**LLM assessment:** The dashboard has genuine product identity. The KWD currency format (3 decimal places), FIFO inventory badge, wholesale-specific pipeline statuses (PENDING_PICK, PARTIALLY_RECEIVED, READY_FOR_INVOICE), and the import-cycle pipeline cards are unmistakably WBOS. No generic SaaS template would surface a "Shipments" pipeline alongside "Purchase Orders" with these specific status transitions. The teal border-left accent on hero metrics, the border-driven flat architecture, and the restrained color palette all read as authored for this specific design system. However, the *layout pattern* (hero KPIs → exception panel → pipeline cards → charts → activity feed) is a recognizable dashboard template. The differentiation comes from domain-specific data treatment (status distributions with semantic color dots, FIFO tooltip, KWD formatting) rather than from novel compositional choices. A Kuwaiti wholesale snack importer would recognize this as their system. A random business operator would not immediately identify the industry from the layout alone — the specificity lives in the content layer, not the spatial layer.

**Deterministic scan:** 2 findings — both advisory `design-system-font-size` for 9px in SVG chart annotations. These are false positives: 9px is standard for SVG chart labels/annotations in viewBox-scaled coordinate spaces and is not body text. The type ramp doesn't need to accommodate SVG coordinate-space text.

---

## Overall Impression

The dashboard has improved significantly from the pre-redesign state. The three-tier hierarchy (hero → pipeline → charts/activity), the consolidated Action Needed section, and the pipeline overdue alerts are strong design decisions. The design system compliance is excellent — flat-by-default preserved, teal used sparingly, borders as the primary structural element. The remaining gaps are primarily around interactivity (no drill-down, no date ranges), data freshness (no loading states), and progressive disclosure (status glossary, urgency ordering). The dashboard serves its purpose as an operational overview but hasn't yet reached its potential as a true command center that directs daily action.

---

## What's Working

1. **The Action Needed section is the strongest design decision on the page.** Consolidating overdue invoices, low stock items, and delayed orders into a single exception panel with destructive border treatment answers the question "what do I need to do right now?" — the most important question any business dashboard can answer. The conditional rendering (hidden when clear) is correct. This section alone transforms the dashboard from informational to operational.

2. **Pipeline status cards with semantic color dots and distribution bars are genuinely distinctive.** No generic dashboard template includes order lifecycle visualization. The color-coded dots (blue=DRAFT, amber=PENDING, teal=APPROVED, emerald=PAID) create a visual language that a wholesale operator learns quickly. The overdue alert badge on pipeline cards bridges the gap between "status overview" and "exception surfacing."

3. **The restrained teal usage respects the design system's "Sparingly Teal Rule."** Teal appears only on: hero metric left borders, the FIFO badge, chart bars, and the most recent activity dot. That's roughly 10-12% of the visual surface — well within the 15% guideline. The result is a dashboard where teal genuinely signals "this is the active/important thing" rather than being decorative noise.

---

## Priority Issues

### P1 — No loading states or data freshness indicator

**What:** The dashboard is server-rendered with no client-side loading state, no skeleton UI, and no "last updated" timestamp. On slow connections, users see either a blank page or stale data with no indication.

**Why it matters:** A business owner checking the dashboard at 8 AM before making purchasing decisions needs to know if the data is current. Stale receivables data could lead to incorrect payment follow-ups. Stale low-stock data could mean missed reorder opportunities. Trust erodes when data appears to be from yesterday.

**Fix:** Add a subtle "Updated X ago" timestamp in the dashboard header area (next to the org name). For initial load, add a minimal skeleton state (gray placeholder bars matching the hero card layout) that shows during server rendering. Consider a client-side refresh mechanism (button or interval) for users who keep the dashboard open.

**Suggested command:** `/impeccable shape` — add loading states and data freshness indicator

---

### P1 — Action Needed section lacks sub-group headers and urgency ordering

**What:** Overdue invoices, low stock items, and delayed orders are listed in a single flat list. There's no visual sub-grouping, no summary count, and no urgency prioritization across types. The most urgent item (e.g., an invoice 45 days overdue) may be buried below a 2-day-overdue invoice.

**Why it matters:** When a business owner has 5 overdue invoices, 3 low stock items, and 2 delayed shipments, they need to decide what to act on first. The current flat list doesn't help with prioritization.

**Fix:** Add thin sub-headers ("Overdue Invoices (5)", "Low Stock (3)", "Delayed Orders (2)") to create visual grouping. Sort overdue invoices by days overdue (most overdue first). Add a brief summary line at the top: "5 overdue invoices, 3 low stock items, 2 delayed orders."

**Suggested command:** `/impeccable shape` — improve Action Needed grouping and urgency ordering

---

### P2 — SVG charts lack meaningful accessibility beyond basic ARIA

**What:** The TrendChart and TopItemsChart have `role="img"`, `aria-label`, `<title>`, and `<desc>` — correct for decorative charts. But these charts contain meaningful business data (monthly sales totals, top product rankings with values). A screen reader user hears "Monthly sales trend chart" but cannot access the actual data points.

**Why it matters:** While the primary users (2-5 person family business) may not use screen readers, accessibility is a legal requirement in many jurisdictions and a quality signal. If the business grows or the owner has a visual impairment, the charts become useless.

**Fix:** Add an `aria-describedby` pointing to a visually-hidden data table, or add `<table class="sr-only">` within the SVG containing the same data in tabular form.

**Suggested command:** `/impeccable harden` — add accessible data tables for SVG charts

---

### P2 — Unpaid Invoices panel is spatially disconnected from its hero counterpart

**What:** The "Outstanding Receivables" hero card (top row) shows a total amount and unpaid invoice count. The "Unpaid Invoices" panel (bottom-right in a 3-column grid) shows the same invoices with detail. These represent the same data at different granularity, separated by ~600px of vertical space with no visual connection.

**Why it matters:** A user who sees "12,450 KWD outstanding" on the hero card and wants to see which invoices compose that total must scroll past the pipeline cards, charts, and activity feed to find the detail panel.

**Fix:** Add a "View details" link or anchor on the Outstanding Receivables hero card that scrolls to the Unpaid Invoices panel. Alternatively, move the unpaid invoices list closer to the hero metrics.

**Suggested command:** `/impeccable shape` — connect receivables hero card to invoice detail panel

---

### P3 — No help/glossary for pipeline status colors

**What:** The pipeline cards use 7-8 distinct status colors (blue, amber, teal, violet, emerald, red) with no legend, tooltip, or glossary. A new user sees colored dots but doesn't know what "READY_FOR_INVOICE" (cyan) vs "INVOICED" (purple) means in the order lifecycle.

**Why it matters:** For a 2-5 person team where "everyone wears multiple hats," new employees or family members joining the business need to learn the pipeline statuses.

**Fix:** Add a small info icon or "?" tooltip on each pipeline card header that reveals a brief glossary of statuses, matching the FIFO tooltip pattern already established.

**Suggested command:** `/impeccable shape` — add status glossary tooltips to pipeline cards

---

## Persona Red Flags

### Alex (Power User / Business Owner)

- **No date range control.** Alex wants to see "this quarter" vs "last quarter" but the sales trend is locked to 6 months. No way to adjust the time window.
- **No drill-down from pipeline counts.** Clicking "6 Sales Orders" goes to the full list. Alex wants "show me just the 2 DRAFT orders" — the pipeline card shows the distribution but doesn't let you filter by it.
- **Activity feed is low-signal.** "Invoice created", "Sales order updated" — Alex needs to know *which* invoice, *which* order, and *who* did it.

### Sam (Operations / Warehouse)

- **Low stock threshold is opaque.** The dashboard says "below 10 units" but Sam doesn't know if 10 is the right threshold for every product. Some snacks sell fast (chips: threshold should be 50), some sell slow (specialty items: threshold could be 5). The threshold is hardcoded.
- **Pipeline overdue badge doesn't differentiate by severity.** "1 overdue" could mean 1 day late or 30 days late. Sam needs to know urgency to prioritize.

---

## Minor Observations

1. **Sales delta badge appears twice** — once on the Sales This Month hero card and once on the Monthly Sales Trend chart header. The hero card badge is more prominent; the chart header badge adds noise without new information.

2. **Activity feed uses index keys (`key={i}`)** instead of stable identifiers. If activity logs have an `id` field, this should be `key={log.id}` for correct React reconciliation.

3. **Pipeline card "No records" state is a missed onboarding moment.** When a pipeline has zero records, "Create your first sales order" with a CTA button would be more helpful than plain "No records" text.

4. **Onboarding panel and dashboard compete for vertical space.** When onboarding is incomplete, the progress panel takes ~300px before the hero metrics appear. Consider collapsing it more aggressively or making it dismissible.

---

## Questions to Consider

1. **Should the dashboard adapt based on user role?** Alex (owner) cares about receivables and sales trends. Sam (operations) cares about shipments and stock levels. A role-based layout could show the most relevant KPIs first.

2. **Is the current exception hierarchy correct?** Overdue invoices are listed first in Action Needed. For a wholesale import business, delayed purchase orders (which affect incoming stock) might be more urgent than overdue invoices (which are financial but don't block operations).

3. **Should pipeline cards be interactive beyond navigation?** What if hovering over a status dot showed the specific orders in that status? This would transform the pipeline from "status overview" to "actionable filter."

4. **Is the 6-month sales trend the right window?** Wholesale snack import is seasonal (Ramadan, summer, school season). A 12-month trend with year-over-year comparison might be more actionable.
