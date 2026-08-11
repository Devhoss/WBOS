---
target: src/app/page.tsx
slug: src-app-page-tsx
date: 2026-08-09
total_score: 25
max_score: 36
na_heuristics: "9"
p0_count: 0
p1_count: 3
p2_count: 3
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
| 1 | Visibility of System Status | 3 | Good data visibility, but no loading states, no refresh indicator, no "last updated" timestamp |
| 2 | Match Between System and Real World | 4 | Wholesale terminology is accurate (KWD, FIFO, PO, GRN). Language matches the business domain. |
| 3 | User Control and Freedom | 3 | Sidebar nav works, cards link to reports. No date range filters, no drill-down from pipeline cards to filtered lists. |
| 4 | Consistency and Standards | 4 | Consistent with DESIGN.md. Status colors centralized. Card patterns uniform. Pipeline cards match card spec. |
| 5 | Error Prevention | 2 | No loading skeleton (flash of empty content on slow connections). No warning when data might be stale. |
| 6 | Recognition Rather Than Recall | 3 | Pipeline status dots are scannable. Activity feed shows entity types. But pipeline cards don't highlight which specific items need action. |
| 7 | Flexibility and Efficiency | 2 | No keyboard shortcuts. No date range selector. No customizable layout. No "mark as read" on alerts. |
| 8 | Aesthetic and Minimalist Design | 3 | Clean, purposeful. But unpaid invoices section feels structurally disconnected (different column span, no visual tie to hero metrics). |
| 9 | Error Recovery | n/a | Dashboard is read-only; no user errors to recover from. |
| 10 | Help and Documentation | 1 | No contextual help on FIFO badge, no glossary tooltips, no "what does this mean?" for pipeline statuses. |
| **Total** | | **25/36** | **Good** (69%) |

---

## Design Specificity Verdict

**Does it feel authored for this product, or category-interchangeable?**

**LLM assessment:** The dashboard has genuine product character — the teal accent, border-driven structure, KWD currency, FIFO badge, and wholesale pipeline statuses (PENDING_PICK, GRN, READY_FOR_INVOICE) are unmistakably WBOS. The pipeline status cards with semantic color dots are a strong distinctive element that generic dashboards don't have. However, the overall layout pattern (hero KPIs → charts → activity) is a standard dashboard template. The differentiation comes from the *data* (wholesale-specific statuses, import cycle pipeline), not from the *layout*.

**Deterministic scan:** 2 findings — both advisory `design-system-font-size` for 9px in SVG chart annotations. These are false positives: 9px is standard for SVG chart labels/annotations and is not body text. The type ramp doesn't need to accommodate SVG coordinate-space text.

---

## Overall Impression

The dashboard is solid and functional. The hero metrics with teal left borders are a clear improvement over the previous flat layout. The pipeline status cards are the strongest element — they genuinely communicate operational health in a way that generic KPI cards never could. The color system is restrained and meaningful.

But it's not yet a *command center*. A command center surfaces exceptions and directs action. This dashboard surfaces data well but doesn't clearly answer "what do I need to do right now?" The low stock items are computed but hidden. There's no consolidated view of overdue invoices + low stock + delayed shipments. The hero metrics all look the same — nothing screams "urgent" except the overdue customers card. The biggest missed opportunity: the pipeline cards show status distributions but don't highlight which items are overdue or need escalation.

---

## What's Working

1. **Pipeline status cards are excellent.** The semantic color dots + progress bars for Sales Orders, Purchase Orders, and Shipments communicate operational health at a glance. This is the most distinctive and useful element on the dashboard. A business owner can immediately see "most POs are approved, a few are partially received" without drilling into reports.

2. **Overdue customers card with destructive color.** The dynamic color shift (teal → red when overdue > 0) is a smart exception-surfacing pattern. The "need attention" / "all clear" subtitle provides instant context. This is how exception-based dashboards should work.

3. **Hero metrics with teal left border.** The `border-l-[3px] border-l-primary` treatment creates clear visual hierarchy between hero KPIs and secondary cards. The FIFO badge on Inventory Value is a nice domain-specific touch.

---

## Priority Issues

### P1 — Low stock items computed but never displayed

**What:** `dashboard-service.ts` computes `lowStockCountResult` via `_countLowStock()` (an index-driven groupBy query), but the dashboard page never renders it. The data is fetched, processed, and discarded.

**Why it matters:** Low stock is one of the most critical operational alerts for a wholesale business. Running out of stock means lost sales. The data is already there — it just needs a card. This is a pure data waste and a missing actionable exception.

**Fix:** Add a "Low Stock Items" hero metric card. When count > 0, use destructive color (same pattern as overdue customers). Link to `/reports/inventory/current-stock` with a low-stock filter. Add a subtitle showing the threshold ("below 10 units").

**Suggested command:** `/impeccable shape` — add low stock to hero metrics

---

### P1 — No consolidated "Action Needed" section

**What:** Actionable exceptions are scattered across the dashboard: overdue customers (hero card), unpaid invoices (bottom-right panel), low stock (not shown), delayed shipments (not shown). There's no single place that answers "what needs my attention right now?"

**Why it matters:** A business owner opening the dashboard should see a prioritized list of exceptions within 3 seconds. Currently, they have to scan the entire page to find action items. The unpaid invoices panel is particularly buried — it's in the bottom-right corner, visually disconnected from the hero metrics.

**Fix:** Create an "Action Needed" section that consolidates: (1) overdue invoices with amounts, (2) low stock items, (3) shipments past expected delivery date. Use a compact list format with destructive/amber color coding. Place it prominently — either above the charts or as a full-width section between hero metrics and pipeline.

**Suggested command:** `/impeccable shape` — design action-needed exception panel

---

### P1 — Hero metrics lack trend/change indicators

**What:** The four hero cards show static values (12,450.000 KWD) with no indication of whether this is better or worse than last month. A business owner seeing "Sales this month: 12,450 KWD" doesn't know if that's good or bad without mentally comparing to last month.

**Why it matters:** KPIs without context are just numbers. A trend arrow (↑ 12% vs last month) or a simple comparison ("last month: 10,200 KWD") transforms a number into actionable intelligence. The data to compute this exists — `getSalesTrend` already fetches 6 months of data.

**Fix:** Add a subtle trend indicator below each hero metric value. For sales: show month-over-month change percentage with a small up/down arrow. For receivables: show change from last month. For inventory: show change. For overdue: show whether count increased or decreased. Use existing trend data — no new queries needed.

**Suggested command:** `/impeccable shape` — add trend indicators to hero KPIs

---

### P2 — Sales trend chart lacks period comparison

**What:** The 6-month bar chart shows raw monthly totals with an average line, but no month-over-month comparison or growth rate. The owner can see "March was 15K" but not "March was up 20% from February."

**Why it matters:** A trend chart without comparison context is just a picture of data. The most useful insight is "is things getting better or worse?" The average line helps, but a growth indicator (e.g., "↑ 15% vs last month" as a badge on the chart) would be more actionable.

**Fix:** Add a small summary badge above the chart showing the latest month's performance vs the previous month (e.g., "Aug: ↑ 12% vs Jul" in green, or "Aug: ↓ 8% vs Jul" in red). Use existing trend data — compute the delta in the chart component.

**Suggested command:** `/impeccable shape` — add growth indicator to sales trend

---

### P2 — Pipeline cards don't surface overdue/delayed items

**What:** The pipeline cards show status distributions (e.g., "Sales Orders: 6 confirmed, 4 processing, 2 shipped") but don't highlight which specific orders are overdue, which shipments are past their expected delivery date, or which POs need approval.

**Why it matters:** Status counts are informational, not actionable. "4 processing" doesn't tell the owner which orders to prioritize. The pipeline should surface exceptions: "2 shipments overdue by 3+ days" or "1 PO awaiting approval for 5 days."

**Fix:** Add a small alert badge on pipeline cards when overdue/delayed items exist. For example, if any shipments are past `expectedDeliveryDate`, show a red badge "2 overdue" on the Shipments card. For POs, show "1 awaiting approval" when items are in PENDING_APPROVAL status for >2 days. This requires a new query: count shipments where `status != DELIVERED` AND `expectedDeliveryDate < now`.

**Data requirement:** New query needed — `shipment.count({ where: { status: { notIn: ['DELIVERED', 'CANCELLED'] }, expectedDeliveryDate: { lt: new Date() } } })`. Add to `getPipelineStatus()`.

**Suggested command:** `/impeccable shape` — add overdue alerts to pipeline cards

---

### P2 — Unpaid invoices section feels structurally disconnected

**What:** The unpaid invoices panel is in the bottom-right corner of a 3-column grid, visually isolated from the hero metrics and pipeline cards above it. It's the only place showing individual invoice details, but it feels like an afterthought.

**Why it matters:** Unpaid invoices are a primary action item for a wholesale business. They should be visually connected to the "Outstanding Receivables" hero metric — perhaps as an expandable detail below it, or as part of the action-needed section.

**Fix:** Move unpaid invoices into the action-needed section (P1 fix), or create a visual connection between the "Outstanding Receivables" hero card and the unpaid invoices list (e.g., a "View unpaid →" link on the hero card that anchors to the invoices section).

**Suggested command:** `/impeccable shape` — integrate unpaid invoices into action flow

---

## Persona Red Flags

### Alex (Power User / Business Owner)

- **No keyboard shortcuts.** Can't quickly navigate between dashboard sections or trigger actions. The pipeline cards link to list pages but there's no way to filter those lists from the dashboard.
- **No date range selector.** Can't view "last 30 days" vs "this quarter" vs "this year." The sales trend is locked to 6 months.
- **No drill-down.** Clicking "Sales Orders" goes to the full list, not a filtered view of orders in a specific status. The pipeline card shows "6 confirmed" but clicking it doesn't show just those 6.
- **Low stock not visible.** Alex checks stock levels daily. Having to navigate to a separate report is friction.

### Jordan (First-Timer / New Employee)

- **FIFO badge unexplained.** "What does FIFO mean?" — no tooltip, no glossary link. A new employee sees "FIFO" on the Inventory Value card and has no context.
- **Pipeline status colors unexplained.** "What's the difference between blue and amber dots?" — no legend, no tooltip explaining what each status means in the import cycle.
- **No onboarding for dashboard interpretation.** The onboarding panel covers setup (warehouses, products) but not "how to read this dashboard."

---

## Minor Observations

1. **9px font in SVG charts** — detector flagged this twice. These are standard chart annotation sizes for SVG coordinate space, not body text. Not a real issue.

2. **"today:" subtitle uses lowercase** — `today: 1,200.000 KWD` could be `Today: 1,200.000 KWD` for consistency with other subtitles.

3. **Activity feed entity types are raw** — `entityType` shows "invoice", "salesOrder" as raw strings. Could be formatted ("Invoice", "Sales Order") for readability.

4. **Pipeline card "No records" state** — When a pipeline has zero records, it shows "No records" in muted text. This is correct but could use a subtle icon or CTA ("Create your first sales order →").

5. **Top Products and Top Customers charts are identical in structure** — Both use the same `TopItemsChart` component. Consider adding a "period" label (e.g., "All time" or "Last 6 months") to clarify the time range.

---

## Questions to Consider

1. **Should the dashboard have a dedicated "Action Center" section?** Right now, action items (overdue invoices, low stock, delayed shipments) are scattered. A consolidated exception panel — similar to how GitHub shows "Review requested" or Slack shows "Threads you're mentioned in" — could make the dashboard genuinely actionable rather than just informational.

2. **Is the sales trend chart the most useful visualization?** For a wholesale business, a stacked bar showing sales by category (snacks, beverages, etc.) or by customer segment might reveal more actionable insights than a single revenue line. The data exists in `invoiceLine.groupBy`.

3. **Should pipeline cards be interactive beyond linking to list pages?** What if clicking "6 confirmed" on the Sales Orders card opened a filtered view of those specific orders? This would transform the pipeline from informational to operational.

---

> **Trend for `src-app-page-tsx`:** First run after redesign (previous critique was pre-redesign, score 25/40). This run: 25/36 (different heuristic set — heuristic 9 marked n/a for read-only dashboard).
