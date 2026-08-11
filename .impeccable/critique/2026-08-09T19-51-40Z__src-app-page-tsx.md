---
target: src/app/page.tsx
slug: src-app-page-tsx
total_score: 25
max_score: 36
na_heuristics: 10
p0_count: 0
p1_count: 1
p2_count: 2
timestamp: 2026-08-09T19-51-40Z
---
# Dashboard Critique — WBOS Command Center

**Method: dual-agent (A: design review · B: detector scan)**
**Date:** 2026-08-09
**Mode:** Operate (task-completion UI)
**Scope:** Dashboard page only (`src/app/page.tsx`, `simple-bar-chart.tsx`, `dashboard-service.ts`)

---

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | "Updated HH:MM" timestamp is good. Pipeline cards show live counts. No loading skeleton or error state if queries fail. |
| 2 | Match Between System and Real World | 3 | Pipeline glossary tooltips are excellent. "FIFO" badge requires hover to decode. "Outstanding receivables" is accounting jargon — acceptable for this audience. |
| 3 | User Control and Freedom | 3 | Every card is a link. Back-navigation is implicit. No "dismiss" on Action Needed or "mark as read" on exceptions. |
| 4 | Consistency and Standards | 4 | Consistent card radius, border-driven depth, Inter typography, tabular-nums on all numbers, focus-visible ring throughout. Minor: border treatments vary across hero cards (see P1). |
| 5 | Error Prevention | 2 | No skeleton loading states. No error boundary. If any of the 7 parallel queries fails, the page crashes with no recovery. |
| 6 | Recognition Rather Than Recall | 4 | Pipeline glossary tooltips. Action Needed sub-headers. Status badges with color. Trend arrows on sales. Exception counts visible without clicking. |
| 7 | Flexibility and Efficiency | 1 | No date range selector. No search. No personalization. No way to filter pipeline by status. No way to sort Activity. "Top Products" is hard-coded "All time." |
| 8 | Aesthetic and Minimalist Design | 3 | Clean hierarchy. Appropriate density. Action Needed panel is well-scoped. FIFO badge adds domain flair. Could be slightly tighter. |
| 9 | Help and Documentation | 2 | Pipeline glossary tooltips exist but are title-attribute-only (no accessible tooltip component). FIFO badge has title attr only. No onboarding walkthrough for the dashboard itself. |
| 10 | Error Recovery | n/a | Read-only dashboard; no user mutations. |
| **Total** | | **25/36** | **Good** (69%) |

---

## Design Specificity Verdict

**Does it feel authored for this product, or category-interchangeable?**

**LLM assessment:** This dashboard is authentically authored for WBOS, not category-interchangeable. The Kuwaiti Dinar 3-decimal currency formatting, FIFO inventory valuation badge with domain-specific tooltip, wholesale pipeline terminology (PO/SO/SHIPMENT with statuses like PARTIALLY_RECEIVED, READY_FOR_INVOICE, PENDING_PICK), and the low-stock threshold of 10 units all root this in the wholesale snack import domain. The pipeline glossary tooltips translate internal status codes into plain-language business meaning ("Awaiting warehouse pick," "Invoice issued, awaiting payment"). However, the three-tier layout structure (Hero Metrics, Pipeline Status, Charts & Activity) is a dashboard archetype shared by many SaaS products — the specificity lives in the data domain and terminology, not in the visual composition itself.

**Deterministic scan:** 2 findings — both advisory `design-system-font-size` for 9px in SVG chart annotations. These are false positives: 9px is standard for SVG chart labels/annotations and is not body text. The type ramp doesn't need to accommodate SVG coordinate-space text.

---

## Overall Impression

The dashboard is solid and purposeful. The Action Needed panel with sub-headers and urgency sorting is a genuine command-center feature — it answers "what do I need to do right now?" The pipeline glossary tooltips are a smart addition that bridges the gap between internal status codes and business meaning. The accessibility foundations (sr-only tables, aria-describedby) are above average for hand-rolled SVG charts.

The single biggest opportunity: **error resilience**. Seven parallel Prisma queries with no error boundary means a single database timeout crashes the entire dashboard with no recovery. For a business that depends on this view daily, that's a reliability gap that should be addressed before the next feature pass.

---

## What's Working

1. **Action Needed panel is the strongest UX decision on the page.** Consolidating overdue invoices, low stock, and delayed orders into a single scannable section with sub-headers and urgency sorting answers the primary question ("what needs my attention?") without requiring navigation. The summary line ("2 overdue invoices, 3 low stock") gives instant context.

2. **Pipeline glossary tooltips bridge domain knowledge gaps.** The STATUS_GLOSSARY maps internal codes like PENDING_APPROVAL to "Awaiting manager review" — this is genuinely helpful for a wholesale operation where pipeline statuses are not self-explanatory. Placing the tooltip on the card title is the right discovery point.

3. **Accessibility foundations in charts are above average.** Both TrendChart and TopItemsChart include sr-only data tables with proper `<caption>`, `<thead>`, `<th scope="col">`, and `<tbody>`. The SVGs have `role="img"`, `aria-label`, and `aria-describedby`. This demonstrates genuine accessibility intent beyond checkbox compliance.

---

## Priority Issues

### P1 — Hero card border inconsistency

**What:** The four hero cards have inconsistent border treatments. The Inventory Value card uses `border-primary/40` which conflicts with `border-l-primary`, creating a full-border teal effect rather than a left-accent. The Low Stock card dynamically switches `border-l-destructive` but omits the base `border-l-[3px]` in some states.

**Why it matters:** Four cards that should feel like a cohesive set look inconsistent. The inventory card's heavier border breaks the flat-by-default design language established by the other three.

**Fix:** Unify all four cards to use the same base class `border-l-[3px]` with dynamic left-border color only. Remove `border-primary/40` from the inventory card.

**Suggested command:** Unify hero card border treatments in page.tsx — all four cards should use `border-l-[3px]` with dynamic left-border color, no extra border utilities.

---

### P2 — No loading or error states

**What:** The AnalyticsDashboard component makes 7 parallel Prisma queries. If any fails, the entire page throws an unhandled error with no recovery. There is also no skeleton loading state — the page is a server component that either renders fully or not at all.

**Why it matters:** In production, database timeouts, connection issues, or a single bad query will crash the dashboard with no user-friendly message. For an operate-mode dashboard that users depend on daily, this is a reliability gap.

**Fix:** Wrap AnalyticsDashboard in a React error boundary with a fallback UI. Add a Suspense boundary with skeleton placeholders for the hero metrics, pipeline cards, and charts.

**Suggested command:** Add error boundary and Suspense skeleton states to the dashboard in page.tsx.

---

### P3 — Hardcoded low-stock threshold

**What:** The threshold of 10 units is hardcoded in two places in dashboard-service.ts and referenced in the UI copy "below 10 units." There is no way for a user to configure this threshold.

**Why it matters:** A wholesale snack importer may want different thresholds per category (e.g., high-volume items at 50 units, slow-movers at 5). The hardcoded value is invisible to the user — they see "5 low stock items" but don't know the threshold or how to change it.

**Fix:** Add a lowStockThreshold field to BusinessSettings. Read it in DashboardService. Display the threshold in the hero card subtitle.

**Suggested command:** Add configurable low-stock threshold to business settings and read it in DashboardService.

---

### P4 — Pipeline cards show all statuses including zero-count

**What:** Each PipelineCard displays ALL statuses sorted by count. When a Sales Orders pipeline has 7 statuses, the card shows 7 rows with mini progress bars, even when some have zero items.

**Why it matters:** The cognitive load of scanning 7 status rows per card (21 total across 3 pipeline cards) is high. Most users care about the statuses that have work-in-progress, not the zero-count statuses.

**Fix:** Hide zero-count statuses by default. Show a "Show all" link when statuses are filtered.

**Suggested command:** Hide zero-count statuses in PipelineCard by default, with a Show all toggle.

---

### P5 — Empty states lack guidance

**What:** All empty states use the same pattern: centered gray text ("No sales data yet," "No product sales yet"). There is no call-to-action, no indication of what the user should do next.

**Why it matters:** For a user who has just completed onboarding, hitting empty charts creates a sense of "now what?" The dashboard doesn't connect completed steps to expected data.

**Fix:** Add contextual empty-state messages with links. E.g., "No sales data yet — create your first Sales Order →" with a link to /sales/orders/new.

**Suggested command:** Add contextual CTA empty states to dashboard charts and lists.

---

## Persona Red Flags

### Fatima (Finance Manager / Business Owner)

- **Receivables data overlap without reconciliation.** The hero card shows total outstanding while the unpaid invoices list shows individual invoices. If the totals don't match (due to timing of aggregation), she will lose trust in the numbers.
- **No date range selector.** She can't view "last 30 days" vs "this quarter" to compare cash position over time.

### Ahmed (Warehouse Manager)

- **Low stock threshold is invisible.** The hero card says "below 10 units" but the Action Needed panel just says "Low stock" with a count — no threshold information. He doesn't know if "low" means below 10, below 5, or below 1.
- **No drill-down from pipeline cards.** He sees "3 partially received" on the PO card but clicking goes to the full list, not filtered to partially received items.

### Khalid (Business Owner, Mobile)

- **Charts overflow on mobile.** The SVG charts have `minWidth: 640px` and `minWidth: 480px`, forcing horizontal scroll on mobile. A business owner checking on-the-go gets a broken experience.
- **Pipeline cards stack but charts don't.** The responsive grid works for cards but not for the chart section.

---

## Minor Observations

1. **Activity feed icons are generic.** All activities use the same `Activity` Lucide icon. Different icons per entity (Package for products, User for customers, FileText for orders) would improve scanability.

2. **Status color system is duplicated.** Pipeline cards use manual color maps (`salesOrderColors`, `purchaseOrderColors`, `shipmentColors`) while overdue invoices use `statusColorClass`. Two parallel color systems for the same statuses.

3. **`relativeTime()` is server-rendered.** The relative timestamps ("5m ago") are calculated at render time and will be stale after the page loads without a refresh. This is acceptable for a server-rendered dashboard but worth noting.

4. **Trend delta edge case.** If a business had a month with zero sales (e.g., summer shutdown), the trend compares against the last non-zero month, which could be several months old — potentially misleading.

5. **SVG chart labels use abbreviated KWD without currency symbol.** `formatKwdShort()` shows "1.2M" while the hero metrics show "12,450.000 KWD." Mild inconsistency but acceptable for chart readability.

---

## Questions to Consider

1. If the business owner opens the dashboard and sees zero exceptions, do they feel confident ("everything is fine") or anxious ("nothing is happening")? Should there be a positive "all clear" state?

2. The pipeline cards show ALL statuses including zero-count ones. If a business has never used CANCELLED orders, should that status still appear in the glossary tooltip?

3. The sales trend chart shows 6 months. For a seasonal business (snacks spike during Ramadan, National Day), is 6 months enough context? Should there be a year-over-year comparison?

4. The dashboard makes 7+ Prisma queries in parallel on every page load. For a growing business with thousands of invoices, will this remain fast? Should there be a materialized view or cache layer?

5. The Action Needed panel mixes cash-flow anxiety (overdue invoices) with operational anxiety (low stock, delayed orders). Should these be separated so a finance-focused user doesn't see warehouse alerts, and vice versa?
