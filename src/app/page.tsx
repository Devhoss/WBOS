import {
  Activity, ArrowUpRight, BarChart3, CalendarRange, Coins, DollarSign,
  Package, ShoppingCart, TriangleAlert, Truck, Users,
} from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { OnboardingPanel } from "@/components/onboarding-panel";
import { getCachedContext } from "@/infrastructure/request/authenticated-request-context";
import { prisma } from "@/infrastructure/database/prisma";
import { cn } from "@/lib/utils";

import { DashboardService } from "./dashboard-service";
import { TrendChart, TopItemsChart } from "./simple-bar-chart";

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
            </p>
          </div>
          {onboardingIncomplete ? (
            <Link
              href="/settings"
              className="hidden text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground sm:block"
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

        <AnalyticsDashboard orgId={orgId} currency={context.organization.defaultCurrency} />
      </div>
    </AppShell>
  );
}

async function AnalyticsDashboard({ orgId, currency }: { orgId: string; currency: string }) {
  const svc = new DashboardService();
  const [data, trend, topProducts, topCustomers] = await Promise.all([
    svc.getOperationalSummary(orgId),
    svc.getSalesTrend(orgId),
    svc.getTopProducts(orgId),
    svc.getTopCustomers(orgId),
  ]);

  const statusLabel: Record<string, string> = {
    DRAFT: "Draft",
    PENDING_APPROVAL: "Pending Approval",
    APPROVED: "Approved",
    PARTIALLY_RECEIVED: "Partially Received",
    PENDING: "Pending",
    PICKING: "Picking",
    PICKED: "Picked",
    VERIFIED: "Verified",
    ISSUED: "Issued",
    PARTIALLY_PAID: "Partially Paid",
    OVERDUE: "Overdue",
  };

  return (
    <>
      <section className="space-y-3">
        <SectionHeading>Operations</SectionHeading>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            icon={Package}
            label="Active Products"
            value={data.stats.activeProducts.toLocaleString()}
            href="/products"
          />
          <KpiCard
            icon={ShoppingCart}
            label="Open Purchase Orders"
            value={data.stats.openPOs.toLocaleString()}
            href="/purchasing/orders"
          />
          <KpiCard
            icon={Truck}
            label="Pending Shipments"
            value={data.stats.pendingShipments.toLocaleString()}
            href="/sales/shipments"
          />
          <KpiCard
            icon={TriangleAlert}
            label="Low Stock Items"
            value={data.kpis.lowStockItems.toLocaleString()}
            href="/inventory/stock"
          />
        </div>
      </section>

      <section className="mt-6 space-y-3">
        <SectionHeading>Financial</SectionHeading>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            icon={Coins}
            label="Inventory Value"
            value={money(data.kpis.inventoryValue, currency)}
            href="/reports/inventory/valuation"
            emphasis
          />
          <KpiCard
            icon={DollarSign}
            label="Outstanding Receivables"
            value={money(data.kpis.outstandingReceivables, currency)}
            href="/reports/financial/outstanding-balances"
          />
          <KpiCard
            icon={BarChart3}
            label="Today's Sales"
            value={money(data.kpis.salesToday, currency)}
            href="/reports/sales/trend"
          />
          <KpiCard
            icon={CalendarRange}
            label="This Month Sales"
            value={money(data.kpis.salesThisMonth, currency)}
            href="/reports/sales/trend"
          />
        </div>
      </section>

      <section className="mt-6 space-y-3">
        <SectionHeading>Customers</SectionHeading>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            icon={Users}
            label="Overdue Customers"
            value={data.kpis.overdueCustomers.toLocaleString()}
            href="/reports/financial/ar-aging"
          />
          <Link href="/reports" className="group relative rounded-lg border bg-background p-5 transition hover:shadow-sm">
            <div className="flex size-10 items-center justify-center rounded-md bg-muted">
              <BarChart3 className="size-5 text-primary" />
            </div>
            <p className="mt-4 text-sm font-medium text-muted-foreground">
              Reports &amp; Analytics <ArrowUpRight className="ml-1 inline size-3" />
            </p>
            <p className="mt-1 text-xs text-muted-foreground">View all reports</p>
          </Link>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="min-w-0 rounded-lg border">
          <div className="border-b px-5 py-4"><h2 className="text-sm font-semibold">Monthly Sales Trend</h2></div>
          <div className="p-4">
            {trend.length > 0 ? <TrendChart data={trend} /> : (
              <p className="py-8 text-center text-sm text-muted-foreground">No sales data yet.</p>
            )}
          </div>
        </section>
        <section className="min-w-0 rounded-lg border">
          <div className="border-b px-5 py-4"><h2 className="text-sm font-semibold">Top Products</h2></div>
          <div className="p-4">
            {topProducts.length > 0 ? <TopItemsChart data={topProducts} /> : (
              <p className="py-8 text-center text-sm text-muted-foreground">No product sales yet.</p>
            )}
          </div>
        </section>
      </div>

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
                  <Activity className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{log.summary}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(log.createdAt).toLocaleDateString()} &middot; {log.entityType}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        <div className="min-w-0 space-y-6">
          <section className="rounded-lg border">
            <div className="border-b px-5 py-4"><h2 className="text-sm font-semibold">Top Customers</h2></div>
            <div className="p-4">
              {topCustomers.length > 0 ? <TopItemsChart data={topCustomers} /> : (
                <p className="py-8 text-center text-sm text-muted-foreground">No customer sales yet.</p>
              )}
            </div>
          </section>
          <section className="rounded-lg border">
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
                        <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">{statusLabel[inv.status] ?? inv.status}</span>
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

function money(value: number, currency: string): string {
  return `${value.toFixed(3)} ${currency}`;
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h2>
  );
}

function KpiCard({ icon: Icon, label, value, href, emphasis = false }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  href: string;
  emphasis?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group rounded-lg border bg-background p-4 transition hover:shadow-sm sm:p-5",
        emphasis && "border-primary/40 shadow-sm",
      )}
    >
      <div className="flex items-center justify-between">
        <div className={cn(
          "flex size-10 items-center justify-center rounded-md text-primary",
          emphasis ? "bg-primary/10" : "bg-muted",
        )}>
          <Icon className={cn("size-5", emphasis && "text-primary")} />
        </div>
        {emphasis ? (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
            Costing
          </span>
        ) : null}
      </div>
      <p className={cn(
        "mt-4 truncate text-2xl font-semibold tracking-tight tabular-nums",
        emphasis && "text-primary",
      )}>
        {value}
      </p>
      <p className="mt-1 truncate text-sm text-muted-foreground">{label}</p>
    </Link>
  );
}