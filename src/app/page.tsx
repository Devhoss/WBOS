import { Suspense } from "react";
import {
  Activity, ArrowDownRight, ArrowUpRight, CalendarRange, Coins, DollarSign,
  Package, TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { OnboardingPanel } from "@/components/onboarding-panel";
import { statusColorClass, formatStatus } from "@/components/status-colors";
import { getCachedContext } from "@/infrastructure/request/authenticated-request-context";
import { prisma } from "@/infrastructure/database/prisma";
import { cn } from "@/lib/utils";

import {
  DashboardService, type StatusCount,
} from "./dashboard-service";
import { TrendChart, TopItemsChart } from "./simple-bar-chart";
import { ErrorBoundary } from "./error-boundary";
import { DashboardSkeleton } from "./dashboard-skeleton";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const context = await getCachedContext();
  const orgId = context.organizationId;

  const [productCount, customerCount, supplierCount, warehouseCount, soCount, poCount] =
    await Promise.all([
      prisma.product.count({ where: { organizationId: orgId, archivedAt: null } }),
      prisma.customer.count({ where: { organizationId: orgId } }),
      prisma.supplier.count({ where: { organizationId: orgId } }),
      prisma.warehouse.count({ where: { organizationId: orgId } }),
      prisma.salesOrder.count({ where: { organizationId: orgId } }),
      prisma.purchaseOrder.count({ where: { organizationId: orgId } }),
    ]);

  const steps = [
    { label: "Warehouses", done: warehouseCount > 0, href: "/warehouses" },
    { label: "Products", done: productCount > 0, href: "/products" },
    { label: "Customers", done: customerCount > 0, href: "/customers" },
    { label: "Suppliers", done: supplierCount > 0, href: "/suppliers" },
    { label: "Sales Orders", done: soCount > 0, href: "/sales/orders" },
    { label: "Purchase Orders", done: poCount > 0, href: "/purchasing/orders" },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const onboardingIncomplete = doneCount < steps.length;

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-4 sm:space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-normal">Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Operational overview for {context.organization.name}.
              <span className="ml-2 text-xs text-muted-foreground/60">
                Updated {new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </p>
          </div>
          {onboardingIncomplete ? (
            <Link
              href="/settings"
              className="hidden text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground sm:block focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-none"
            >
              Settings
            </Link>
          ) : null}
        </div>

        {onboardingIncomplete ? (
          <OnboardingPanel
            steps={steps}
            doneCount={doneCount}
            orgName={context.organization.name}
          />
        ) : null}

        <ErrorBoundary>
          <Suspense fallback={<DashboardSkeleton />}>
            <AnalyticsDashboard orgId={orgId} currency={context.organization.defaultCurrency} />
          </Suspense>
        </ErrorBoundary>
      </div>
    </AppShell>
  );
}

async function AnalyticsDashboard({ orgId, currency }: { orgId: string; currency: string }) {
  const svc = new DashboardService();
  const [data, trend, topProducts, topCustomers, pipeline, lowStockItems, delayedItems] =
    await Promise.all([
      svc.getOperationalSummary(orgId),
      svc.getSalesTrend(orgId),
      svc.getTopProducts(orgId),
      svc.getTopCustomers(orgId),
      svc.getPipelineStatus(orgId),
      svc.getLowStockItems(orgId),
      svc.getDelayedItems(orgId),
    ]);

  const overdueInvoices = data.unpaidInvoices.filter((inv) => inv.status === "OVERDUE");
  const hasExceptions =
    overdueInvoices.length > 0 || lowStockItems.length > 0 || delayedItems.length > 0;
  const now = new Date();
  const daysBetween = (d: Date) => Math.max(0, Math.floor((now.getTime() - d.getTime()) / 86_400_000));

  // Sales trend delta: compare last two complete months from trend data
  const salesDelta: { pct: number; direction: "up" | "down" } | null = (() => {
    const nonZero = trend.filter((t) => t.value > 0);
    if (nonZero.length < 2) return null;
    const prev = nonZero[nonZero.length - 2].value;
    const curr = nonZero[nonZero.length - 1].value;
    if (prev === 0) return curr > 0 ? { pct: 100, direction: "up" } : null;
    const pct = Math.round(((curr - prev) / prev) * 100);
    if (pct === 0) return null;
    return { pct: Math.abs(pct), direction: pct > 0 ? "up" : "down" };
  })();

  // Sort overdue invoices by days overdue (most overdue first)
  const sortedOverdue = [...overdueInvoices].sort((a, b) => {
    const da = a.dueDate ? daysBetween(new Date(a.dueDate)) : 0;
    const db = b.dueDate ? daysBetween(new Date(b.dueDate)) : 0;
    return db - da;
  });

  // Sort delayed items by days late (most late first)
  const sortedDelayed = [...delayedItems].sort((a, b) => {
    return daysBetween(new Date(b.expectedDate)) - daysBetween(new Date(a.expectedDate));
  });

  // Action Needed summary
  const actionSummary = [
    sortedOverdue.length > 0 ? `${sortedOverdue.length} overdue invoice${sortedOverdue.length > 1 ? "s" : ""}` : null,
    lowStockItems.length > 0 ? `${lowStockItems.length} low stock` : null,
    sortedDelayed.length > 0 ? `${sortedDelayed.length} delayed order${sortedDelayed.length > 1 ? "s" : ""}` : null,
  ].filter(Boolean).join(", ");

  return (
    <>
      {/* Hero Metrics — critical KPIs */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Link
          href="/reports/sales/trend"
          className="group rounded-lg border-l-[3px] border border-l-primary bg-background p-4 transition hover:bg-muted/30 sm:p-5 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-none"
        >
          <div className="flex items-center justify-between">
            <div className="flex size-10 items-center justify-center rounded-md bg-primary/10">
              <CalendarRange className="size-5 text-primary" />
            </div>
          </div>
          <p className="mt-4 text-2xl font-semibold tracking-tight tabular-nums">
            {money(data.kpis.salesThisMonth, currency)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Sales this month</p>
          <div className="mt-0.5 flex items-center gap-2">
            <p className="text-xs text-muted-foreground">
              Today: {money(data.kpis.salesToday, currency)}
            </p>
            {salesDelta && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
                  salesDelta.direction === "up"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "bg-red-500/10 text-red-600 dark:text-red-400",
                )}
              >
                {salesDelta.direction === "up" ? (
                  <ArrowUpRight className="size-3" />
                ) : (
                  <ArrowDownRight className="size-3" />
                )}
                {salesDelta.pct}%
              </span>
            )}
          </div>
        </Link>

        <Link
          href="#unpaid-invoices"
          className="group rounded-lg border-l-[3px] border border-l-primary bg-background p-4 transition hover:bg-muted/30 sm:p-5 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-none"
        >
          <div className="flex items-center justify-between">
            <div className="flex size-10 items-center justify-center rounded-md bg-muted">
              <DollarSign className="size-5 text-muted-foreground" />
            </div>
          </div>
          <p className="mt-4 text-2xl font-semibold tracking-tight tabular-nums">
            {money(data.kpis.outstandingReceivables, currency)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Outstanding receivables</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {data.stats.unpaidInvoices} unpaid invoices
          </p>
        </Link>

        <Link
          href="/reports/inventory/valuation"
          className="group rounded-lg border-l-[3px] border border-l-primary bg-background p-4 transition hover:bg-muted/30 sm:p-5 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-none"
        >
          <div className="flex items-center justify-between">
            <div className="flex size-10 items-center justify-center rounded-md bg-primary/10">
              <Coins className="size-5 text-primary" />
            </div>
            <span
              title="First-In, First-Out — inventory valued at the cost of the oldest units in stock"
              className="cursor-help rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary"
            >
              FIFO
            </span>
          </div>
          <p className="mt-4 text-2xl font-semibold tracking-tight tabular-nums text-primary">
            {money(data.kpis.inventoryValue, currency)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Inventory value</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {data.stats.activeProducts.toLocaleString()} active products
          </p>
        </Link>

        <Link
          href="/reports/inventory/current-stock"
          className={cn(
            "group rounded-lg border-l-[3px] border bg-background p-4 transition hover:bg-muted/30 sm:p-5 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-none",
            lowStockItems.length > 0 ? "border-l-destructive" : "border-l-primary",
          )}
        >
          <div className="flex items-center justify-between">
            <div className={cn(
              "flex size-10 items-center justify-center rounded-md",
              lowStockItems.length > 0 ? "bg-destructive/10" : "bg-muted",
            )}>
              {lowStockItems.length > 0 ? (
                <TriangleAlert className="size-5 text-destructive" />
              ) : (
                <Package className="size-5 text-muted-foreground" />
              )}
            </div>
          </div>
          <p className={cn(
            "mt-4 text-2xl font-semibold tracking-tight tabular-nums",
            lowStockItems.length > 0 ? "text-destructive" : "",
          )}>
            {data.kpis.lowStockItems.toLocaleString()}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Low stock items</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {lowStockItems.length > 0 ? `below ${data.kpis.lowStockThreshold} units` : "stock levels healthy"}
          </p>
        </Link>
      </section>

      {/* Action Needed — consolidated exceptions */}
      {hasExceptions ? (
        <section className="rounded-lg border border-destructive/30 bg-background">
          <div className="flex items-center gap-2 border-b border-destructive/20 px-5 py-3">
            <TriangleAlert className="size-4 text-destructive" />
            <h2 className="text-sm font-semibold text-destructive">Action Needed</h2>
            <span className="text-xs text-destructive/70">{actionSummary}</span>
          </div>
          <div className="divide-y divide-destructive/10">
            {/* Overdue invoices */}
            {sortedOverdue.length > 0 && (
              <div className="px-5 py-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Overdue Invoices ({sortedOverdue.length})
                </p>
              </div>
            )}
            {sortedOverdue.map((inv) => {
              const balance = Number(inv.totalAmount) - Number(inv.amountPaid);
              const daysOverdue = inv.dueDate ? daysBetween(new Date(inv.dueDate)) : 0;
              return (
                <Link
                  key={inv.id}
                  href={`/invoices/${inv.id}`}
                  className="flex items-center justify-between px-5 py-3 text-sm transition hover:bg-destructive/5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{inv.invoiceNumber}</span>
                      <span className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        statusColorClass(inv.status),
                      )}>
                        {formatStatus(inv.status)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {inv.customer.name} &middot; {daysOverdue}d overdue
                    </p>
                  </div>
                  <p className="ml-3 shrink-0 text-sm font-medium tabular-nums text-destructive">
                    {money(balance, currency)}
                  </p>
                </Link>
              );
            })}

            {/* Low stock items */}
            {lowStockItems.length > 0 && (
              <div className="px-5 py-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Low Stock ({lowStockItems.length})
                </p>
              </div>
            )}
            {lowStockItems.map((item) => (
              <Link
                key={item.name}
                href="/reports/inventory/current-stock"
                className="flex items-center justify-between px-5 py-3 text-sm transition hover:bg-destructive/5"
              >
                <div className="min-w-0 flex-1">
                  <span className="truncate font-medium">{item.name}</span>
                  <p className="text-xs text-muted-foreground">Low stock</p>
                </div>
                <span className="ml-3 shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                  {item.quantity} left
                </span>
              </Link>
            ))}

            {/* Delayed POs and SOs */}
            {sortedDelayed.length > 0 && (
              <div className="px-5 py-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Delayed Orders ({sortedDelayed.length})
                </p>
              </div>
            )}
            {sortedDelayed.map((item) => {
              const daysLate = daysBetween(new Date(item.expectedDate));
              return (
                <Link
                  key={`${item.type}-${item.number}`}
                  href={item.type === "po" ? "/purchasing/orders" : "/sales/orders"}
                  className="flex items-center justify-between px-5 py-3 text-sm transition hover:bg-destructive/5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{item.number}</span>
                      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                        {item.type === "po" ? "PO" : "SO"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {item.name} &middot; {daysLate}d late
                    </p>
                  </div>
                  <p className="ml-3 shrink-0 text-sm font-medium tabular-nums">
                    {money(item.amount, currency)}
                  </p>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Pipeline Status — order and shipment health */}
      <section className="grid gap-4 sm:grid-cols-3">
        <PipelineCard
          title="Sales Orders"
          total={pipeline.salesOrders.reduce((s, g) => s + g.count, 0)}
          href="/sales/orders"
          statuses={pipeline.salesOrders}
          accentColors={salesOrderColors}
          alertBadge={
            delayedItems.filter((d) => d.type === "so").length > 0
              ? { label: "overdue", count: delayedItems.filter((d) => d.type === "so").length }
              : null
          }
        />
        <PipelineCard
          title="Purchase Orders"
          total={pipeline.purchaseOrders.reduce((s, g) => s + g.count, 0)}
          href="/purchasing/orders"
          statuses={pipeline.purchaseOrders}
          accentColors={purchaseOrderColors}
          alertBadge={
            delayedItems.filter((d) => d.type === "po").length > 0
              ? { label: "overdue", count: delayedItems.filter((d) => d.type === "po").length }
              : null
          }
        />
        <PipelineCard
          title="Shipments"
          total={pipeline.shipments.reduce((s, g) => s + g.count, 0)}
          href="/sales/shipments"
          statuses={pipeline.shipments}
          accentColors={shipmentColors}
        />
      </section>

      {/* Charts — trends and top performers */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="min-w-0 rounded-lg border">
          <div className="border-b px-5 py-4">
            <h2 className="text-sm font-semibold">Monthly Sales Trend</h2>
          </div>
          <div className="p-4">
            {trend.length > 0 ? <TrendChart data={trend} /> : (
              <p className="py-8 text-center text-sm text-muted-foreground">No sales data yet.</p>
            )}
          </div>
        </section>
        <section className="min-w-0 rounded-lg border">
          <div className="border-b px-5 py-4"><h2 className="text-sm font-semibold">Top Products <span className="font-normal text-muted-foreground">· All time</span></h2></div>
          <div className="p-4">
            {topProducts.length > 0 ? <TopItemsChart data={topProducts} /> : (
              <p className="py-8 text-center text-sm text-muted-foreground">No product sales yet.</p>
            )}
          </div>
        </section>
      </div>

      {/* Activity & Details */}
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="min-w-0 rounded-lg border lg:col-span-2">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <h2 className="text-sm font-semibold">Recent Activity</h2>
          </div>
          {data.recentActivity.length === 0 ? (
            <p className="px-5 py-8 text-sm text-muted-foreground">No activity recorded yet.</p>
          ) : (
            <div className="divide-y">
              {data.recentActivity.map((log, i) => (
                <div key={i} className="flex items-start gap-3 px-5 py-3 text-sm">
                  <Activity className={cn(
                    "mt-0.5 size-4 shrink-0",
                    i === 0 ? "text-primary" : "text-muted-foreground",
                  )} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{log.summary}</p>
                    <p className="text-xs text-muted-foreground">
                      {relativeTime(new Date(log.createdAt))} &middot; {formatEntityType(log.entityType)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        <div className="min-w-0 space-y-6">
          <section className="rounded-lg border">
            <div className="border-b px-5 py-4"><h2 className="text-sm font-semibold">Top Customers <span className="font-normal text-muted-foreground">· All time</span></h2></div>
            <div className="p-4">
              {topCustomers.length > 0 ? <TopItemsChart data={topCustomers} /> : (
                <p className="py-8 text-center text-sm text-muted-foreground">No customer sales yet.</p>
              )}
            </div>
          </section>
          <section id="unpaid-invoices" className="rounded-lg border scroll-mt-20">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="text-sm font-semibold">Unpaid Invoices</h2>
              <Link className="text-xs text-muted-foreground hover:text-foreground" href="/invoices">View all <ArrowUpRight className="ml-0.5 inline size-3" /></Link>
            </div>
            {data.unpaidInvoices.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">No unpaid invoices.</p>
            ) : (
              <div className="divide-y">
                {data.unpaidInvoices.map((inv) => {
                  const balance = Number(inv.totalAmount) - Number(inv.amountPaid);
                  return (
                    <Link key={inv.id} className="flex items-center justify-between px-5 py-3 text-sm transition hover:bg-muted/40" href={`/invoices/${inv.id}`}>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{inv.invoiceNumber}</p>
                        <p className="text-xs text-muted-foreground">{inv.customer.name}</p>
                      </div>
                      <div className="ml-3 shrink-0 text-right">
                        <p className="text-xs font-medium tabular-nums">{money(balance, currency)}</p>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColorClass(inv.status)}`}>{formatStatus(inv.status)}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

/* ── Status color maps for pipeline cards ──────────────────────────────────── */

const salesOrderColors: Record<string, string> = {
  DRAFT: "bg-muted-foreground/50",
  PENDING_APPROVAL: "bg-blue-500",
  APPROVED: "bg-primary",
  READY_FOR_INVOICE: "bg-amber-500",
  INVOICED: "bg-violet-500",
  PAID: "bg-emerald-600 dark:bg-emerald-500",
  CANCELLED: "bg-destructive",
};

const purchaseOrderColors: Record<string, string> = {
  DRAFT: "bg-muted-foreground/50",
  PENDING_APPROVAL: "bg-blue-500",
  APPROVED: "bg-primary",
  PARTIALLY_RECEIVED: "bg-amber-500",
  FULLY_RECEIVED: "bg-emerald-600 dark:bg-emerald-500",
  CANCELLED: "bg-destructive",
};

const shipmentColors: Record<string, string> = {
  PENDING_PICK: "bg-muted-foreground/50",
  PICKING: "bg-blue-500",
  PICKED: "bg-primary",
  LOADED: "bg-amber-500",
  OUT_FOR_DELIVERY: "bg-violet-500",
  DELIVERED: "bg-emerald-600 dark:bg-emerald-500",
  FAILED: "bg-destructive",
  CANCELLED: "bg-destructive",
};

/* ── Pipeline Card component ───────────────────────────────────────────────── */

const STATUS_GLOSSARY: Record<string, string> = {
  DRAFT: "Not yet submitted",
  PENDING_APPROVAL: "Awaiting manager review",
  APPROVED: "Confirmed and in progress",
  READY_FOR_INVOICE: "Ready to generate invoice",
  INVOICED: "Invoice issued, awaiting payment",
  PAID: "Payment received",
  PARTIALLY_RECEIVED: "Some items received at warehouse",
  FULLY_RECEIVED: "All items received",
  PENDING_PICK: "Awaiting warehouse pick",
  PICKING: "Items being picked",
  PICKED: "Items picked and packed",
  LOADED: "Loaded for delivery",
  OUT_FOR_DELIVERY: "In transit to customer",
  DELIVERED: "Successfully delivered",
  FAILED: "Delivery failed",
  CANCELLED: "Order cancelled",
};

function PipelineCard({
  title,
  total,
  href,
  statuses,
  accentColors,
  alertBadge,
}: {
  title: string;
  total: number;
  href: string;
  statuses: StatusCount[];
  accentColors: Record<string, string>;
  alertBadge?: { label: string; count: number } | null;
}) {
  const sorted = [...statuses].sort((a, b) => b.count - a.count);
  const glossary = sorted
    .map((s) => `${formatStatus(s.status)}: ${STATUS_GLOSSARY[s.status] ?? s.status}`)
    .join("\n");

  return (
    <Link
      href={href}
      className={cn(
        "rounded-lg border bg-background p-4 transition hover:bg-muted/30 sm:p-5 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-none",
        alertBadge && "border-destructive/30",
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold" title={glossary || undefined}>{title}</h3>
          {alertBadge && (
            <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive tabular-nums">
              {alertBadge.count} {alertBadge.label}
            </span>
          )}
        </div>
        <span className="text-lg font-bold tabular-nums">{total}</span>
      </div>
      {sorted.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">No records</p>
      ) : (
        <div className="mt-3 space-y-2">
          {sorted.map((s) => {
            const pct = total > 0 ? (s.count / total) * 100 : 0;
            const color = accentColors[s.status] ?? "bg-muted-foreground/50";
            return (
              <div key={s.status} className="flex items-center gap-2">
                <span className={cn("inline-block size-2 shrink-0 rounded-full", color)} />
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                  {formatStatus(s.status)}
                </span>
                <span className="shrink-0 text-xs font-medium tabular-nums">{s.count}</span>
                <div className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full", color)}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Link>
  );
}

/* ── Helpers ───────────────────────────────────────────────────────────────── */

function money(value: number, currency: string): string {
  return `${value.toFixed(3)} ${currency}`;
}

function formatEntityType(type: string): string {
  return type
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

function relativeTime(date: Date): string {
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
