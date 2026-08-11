---
target: src/app/page.tsx
type: audit
date: 2026-08-09
dimensions:
  accessibility: 2
  performance: 2
  responsive: 3
  theming: 3
  implementation-integrity: 2
total: 12
rating: Acceptable (significant work needed)
---

# Audit: WBOS Dashboard

**Target:** `src/app/page.tsx` and dashboard components
**Date:** 2026-08-09
**Mode:** Operate (task-completion UI)

---

## Audit Health Score

| # | Dimension | Score | Key Finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | **2/4** | SVG charts have zero a11y markup; touch targets below 44px; missing focus-visible |
| 2 | Performance | **2/4** | 21+ DB queries per page load; `getLowStockCount` fetches all balances in memory |
| 3 | Responsive | **3/4** | Fluid grids work well; touch targets slightly below WCAG minimum |
| 4 | Theming | **3/4** | Tokens used consistently; minor emerald-600 vs emerald-500 drift |
| 5 | Implementation Integrity | **2/4** | Status badges bypass centralized system; hover:shadow-sm violates flat-by-default |
| **Total** | | **12/20** | **Acceptable (significant work needed)** |

---

## Implementation Integrity Verdict

**Start here.** The implementation is **partially coherent**. The core dashboard structure follows the design system (border-driven cards, teal accents, 8px radius), but there are verified drift points:

1. **Status badge bypass**: Unpaid Invoices uses `bg-muted text-muted-foreground` instead of `statusColorClass` — OVERDUE and ISSUED invoices look identical (both gray). This breaks the semantic color language the rest of the app enforces.
2. **Flat-by-default violation**: KpiCard uses `hover:shadow-sm`, explicitly banned by DESIGN.md ("Don't add shadows to cards or sections").
3. **Reports card inconsistent**: The Reports & Analytics card inside Customers uses a different card pattern than KpiCard, breaking visual consistency.

All 7 detector findings are **false positives** — font sizes 10-11px in SVG charts and micro-UI badge counters are contextually appropriate. However, they expose a **documentation gap**: DESIGN.md's type ramp starts at 12px but the codebase legitimately needs a `micro: 10px` tier.

---

## Detailed Findings

### Accessibility

**P1 — SVG Charts Have Zero Accessibility Markup**
- **Location:** `simple-bar-chart.tsx` (TrendChart, TopItemsChart)
- **Category:** Accessibility
- **Impact:** Screen readers either skip the charts entirely or announce raw SVG content. Meaningful business data (monthly sales trend, top products, top customers) is invisible to assistive technology.
- **WCAG:** 1.1.1 Non-text Content (Level A)
- **Recommendation:** Add `role="img"` and `aria-label` to each `<svg>` element. Add `<title>` and `<desc>` for richer descriptions.
- **Suggested command:** `/impeccable harden`

**P1 — Touch Targets Below 44px (WCAG 2.5.5)**
- **Location:** sidebar.tsx:53 (toggle=32px), nav-items.tsx:55 (nav=36px), onboarding-panel.tsx:64 (dismiss=32px)
- **Category:** Accessibility / Responsive
- **Impact:** Mobile users may struggle to tap small interactive elements. WCAG 2.5.5 requires 44x44px minimum for touch targets.
- **WCAG:** 2.5.5 Target Size (Minimum) (Level AAA, but Level A for functional equivalence)
- **Recommendation:** Increase sidebar toggle to h-11 (44px), nav items to h-11 (44px), and onboarding dismiss to size-11 (44px).
- **Suggested command:** `/impeccable adapt`

**P2 — Missing `aria-current="page"` on Navigation**
- **Location:** nav-items.tsx:55-58
- **Category:** Accessibility
- **Impact:** Screen readers cannot determine which page the user is currently on from the navigation.
- **WCAG:** 4.1.2 Name, Role, Value (Level A)
- **Recommendation:** Add `aria-current={active ? "page" : undefined}` to the Link.
- **Suggested command:** `/impeccable harden`

**P2 — Onboarding Progress Bar Missing ARIA**
- **Location:** onboarding-panel.tsx:80-85
- **Category:** Accessibility
- **Impact:** Screen readers do not announce the progress state.
- **WCAG:** 4.1.2 Name, Role, Value (Level A)
- **Recommendation:** Add `role="progressbar" aria-valuenow={doneCount} aria-valuemin={0} aria-valuemax={total} aria-label="Setup progress"` to the outer div.
- **Suggested command:** `/impeccable harden`

**P2 — Missing `focus-visible` Styles on Dashboard Elements**
- **Location:** page.tsx, sidebar.tsx, onboarding-panel.tsx, nav-items.tsx
- **Category:** Accessibility
- **Impact:** Keyboard users get browser-default focus indicators that may be invisible. Other components (dialogs, tooltips) use `focus-visible:ring-2 focus-visible:ring-primary/30`.
- **WCAG:** 2.4.7 Focus Visible (Level AA)
- **Recommendation:** Add consistent `focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-none` to all interactive elements.
- **Suggested command:** `/impeccable harden`

**P3 — Activity Feed Uses Index Keys**
- **Location:** page.tsx:215 (`key={i}`)
- **Category:** Accessibility / Implementation Integrity
- **Impact:** React reconciliation may produce incorrect DOM updates when the list changes. Activity logs likely have an `id` field.
- **Recommendation:** Use `key={log.id}` if available, or `key={log.createdAt}` as fallback.

---

### Performance

**P1 — Dashboard Runs 21+ Database Queries Per Page Load**
- **Location:** dashboard-service.ts (getOperationalSummary runs 15 queries via Promise.all, getSalesTrend runs 6 more, plus top products and top customers)
- **Category:** Performance
- **Impact:** For a self-hosted system on modest hardware, this many queries per page load creates noticeable latency. The `getLowStockCount` method fetches ALL stock balances into memory just to count products below a threshold.
- **Recommendation:** (1) Replace `getLowStockCount` with a targeted Prisma query that counts products with on-hand below threshold. (2) Consider caching with `unstable_cache` or a simple in-memory TTL cache. (3) The monthly sales and daily sales queries are nearly identical — derive daily from monthly.
- **Suggested command:** `/impeccable optimize`

**P2 — Unused Database Queries Wasted**
- **Location:** dashboard-service.ts:55-76 (openPOs, pendingShipments fetched as arrays but only counts rendered)
- **Category:** Performance
- **Impact:** Two full entity queries (findMany with relations) run but the results are never rendered on the dashboard. Only the counts from separate count queries are used.
- **Recommendation:** Remove the findMany queries for openPOs and pendingShipments from getOperationalSummary if they are not displayed.
- **Suggested command:** `/impeccable optimize`

---

### Theming

**P2 — Emerald-600 vs Emerald-500 Token Drift**
- **Location:** onboarding-panel.tsx:96 (`text-emerald-600`), systemic (29+ occurrences across codebase)
- **Category:** Theming
- **Impact:** DESIGN.md defines `status-active: #10b981` (emerald-500). The codebase uses `text-emerald-600` (#059669). This is a shade difference, not a breaking issue, but represents design-system drift.
- **Recommendation:** Align all emerald usages to the DESIGN.md token. This is a codebase-wide fix, not isolated to the dashboard.
- **Suggested command:** `/impeccable document` (to update DESIGN.md) or `/impeccable polish` (to align code)

**P3 — Reduced Motion Rule Is Too Aggressive**
- **Location:** globals.css:131-140
- **Category:** Theming / Accessibility
- **Impact:** The `prefers-reduced-motion` rule kills ALL animations and transitions at 0.01ms, including hover effects and dialog animations. This destroys useful feedback (focus rings, hover states, dialog transitions). WCAG requires preserving state change and hierarchy.
- **WCAG:** 2.3.3 Animation from Interactions (Level AAA)
- **Recommendation:** Scope the reduced motion rule to content animations only. Keep hover feedback and dialog transitions functional.
- **Suggested command:** `/impeccable harden`

---

### Responsive Design

**P3 — Navigation Items Grouping**
- **Location:** nav-items.tsx (20 items in flat list)
- **Category:** Responsive / UX
- **Impact:** On narrow viewports, 20 nav items require extensive scrolling. Business workflow grouping (Purchasing, Sales) would improve scannability.
- **Recommendation:** Add collapsible section groups or use a more compact nav pattern on mobile.
- **Suggested command:** `/impeccable layout`

---

### Implementation Integrity

**P1 — Inconsistent Status Badge System**
- **Location:** page.tsx:88-100, page.tsx:256
- **Category:** Implementation Integrity
- **Impact:** Unpaid Invoices list bypasses `statusColorClass` from status-colors.ts. OVERDUE invoices look identical to ISSUED invoices — both gray. The semantic color system is one of the design system's strongest conventions.
- **Recommendation:** Replace inline status rendering with `statusColorClass` and `formatStatus`. ~10-line change.
- **Suggested command:** `/impeccable polish`

**P2 — KpiCard Uses hover:shadow-sm (Violates Flat-By-Default)**
- **Location:** page.tsx:293
- **Category:** Implementation Integrity
- **Impact:** DESIGN.md states: "Don't add shadows to cards or sections — the flat/border model is intentional. Shadows are for overlays only."
- **Recommendation:** Replace `hover:shadow-sm` with `hover:border-foreground/20` for border-based hover feedback.
- **Suggested command:** `/impeccable polish`

**P2 — Reports Card Uses Different Pattern Than KpiCard**
- **Location:** page.tsx:174-183 vs page.tsx:289-318
- **Category:** Implementation Integrity
- **Impact:** The Reports & Analytics card in the Customers section uses a different card structure than KpiCard (different padding, different element hierarchy). Also misplaced — it's not a customer metric.
- **Recommendation:** Either extract to KpiCard with appropriate props, or move to Financial section.
- **Suggested command:** `/impeccable polish`

**P2 — Nav Items Use Template Literals Instead of `cn()`**
- **Location:** nav-items.tsx:55-59
- **Category:** Implementation Integrity
- **Impact:** Breaks project convention. Won't merge Tailwind classes properly if conflicting utilities are ever added.
- **Recommendation:** Replace template literal with `cn("nav-item flex h-9 ...", active ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground ...")`.
- **Suggested command:** `/impeccable polish`

**P2 — Chart Values Lose KWD Formatting**
- **Location:** simple-bar-chart.tsx:3-4 (`maximumFractionDigits: 0`)
- **Category:** Implementation Integrity
- **Impact:** KWD values on charts show as whole numbers while KWD values on cards show 3 decimals. Inconsistent for the same currency.
- **Recommendation:** Use `maximumFractionDigits: 3` to match the `money()` function.
- **Suggested command:** `/impeccable polish`

**P3 — Activity Feed Lacks Relative Timestamps**
- **Location:** page.tsx:220
- **Category:** Implementation Integrity
- **Impact:** Shows "8/9/2026" but not the time. For an activity feed, "2 hours ago" is more useful for scanning recency.
- **Recommendation:** Use `Intl.RelativeTimeFormat` or a lightweight library for relative timestamps.
- **Suggested command:** `/impeccable polish`

---

## Patterns & Systemic Issues

1. **Touch targets consistently too small (<44px)** — Sidebar toggle, nav items, onboarding dismiss all fail WCAG 2.5.5. This is a mobile-wide pattern, not isolated to the dashboard.
2. **Status badge system partially adopted** — The centralized `statusColorClass` exists but is bypassed in the dashboard. This pattern likely appears in other screens.
3. **Reduced motion kills all feedback** — The aggressive `prefers-reduced-motion` rule in globals.css affects the entire application, not just the dashboard.
4. **emerald-600 vs emerald-500 drift** — Systemic across 29+ occurrences. A codebase-wide alignment pass is needed.

---

## Positive Findings

1. **Clean CSS custom property system** — All theme colors properly defined in HSL with dark mode variants. No hard-coded colors in component files.
2. **Responsive grid implementation** — Dashboard uses proper Tailwind responsive breakpoints (sm:grid-cols-2, xl:grid-cols-4) with fluid behavior.
3. **Print styles are production-ready** — A4 portrait, proper margins, sidebar/header hidden. Professional output.
4. **Sidebar collapse is excellent** — CSS variable-driven, localStorage persistence, Ctrl+B shortcut, CSS-only label hiding, mobile drawer with focus/escape handling.
5. **Data service architecture is clean** — Proper Promise.all parallelization, FIFO costing integration, clean separation of concerns.
6. **Border-driven depth model is consistently applied** — Cards, sections, and containers all use 1px borders. No stray shadows except the one KpiCard violation.

---

## Recommended Actions

1. **[P1] `/impeccable harden`**: Add accessibility markup to SVG charts (role, aria-label), add aria-current to nav, add ARIA to progress bar, add focus-visible styles, fix reduced motion rule.
2. **[P1] `/impeccable optimize`**: Replace getLowStockCount with targeted query, remove unused openPOs/pendingShipments queries, consider caching strategy.
3. **[P1] `/impeccable polish`**: Fix inconsistent status badges (use statusColorClass), replace hover:shadow-sm with border-based hover, align Reports card pattern, fix chart KWD formatting.
4. **[P2] `/impeccable adapt`**: Increase touch targets to 44px minimum on sidebar toggle, nav items, and onboarding dismiss.
5. **[P3] `/impeccable polish`**: Add relative timestamps to activity feed, group nav items by domain.

You can ask me to run these one at a time, all at once, or in any order you prefer.

Re-run `/impeccable audit` after fixes to see your score improve.
