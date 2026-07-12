import {
  Activity, ArrowUpRight, BarChart3, Building2, DollarSign,
  Package, ShoppingCart, Truck, UserPlus, Users,
} from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { prisma } from "@/infrastructure/database/prisma";

import { DashboardService } from "./dashboard-service";
import { TrendChart, TopItemsChart } from "./simple-bar-chart";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  const orgId = context.organizationId;

  const [productCount, customerCount, warehouseCount] = await Promise.all([
    prisma.product.count({ where: { organizationId: orgId, archivedAt: null } }),
    prisma.customer.count({ where: { organizationId: orgId } }),
    prisma.warehouse.count({ where: { organizationId: orgId } }),
  ]);

  const hasData = productCount > 0 || customerCount > 0 || warehouseCount > 0;

  if (!hasData) {
    return <WelcomeDashboard orgId={orgId} orgName={context.organization.name} />;
  }

  return <AnalyticsDashboard orgId={orgId} orgName={context.organization.name} />;
}

async function AnalyticsDashboard({ orgId, orgName }: { orgId: string; orgName: string }) {
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
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="border-b pb-6">
          <h1 className="text-2xl font-semibold tracking-normal">Dashboard</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Operational overview for {orgName}.
          </p>
        </div>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={Package} label="Active Products" value={data.stats.activeProducts} href="/products" />
          <StatCard icon={ShoppingCart} label="Open POs" value={data.stats.openPOs} href="/purchasing/orders" />
          <StatCard icon={Truck} label="Pending Shipments" value={data.stats.pendingShipments} href="/sales/shipments" />
          <StatCard icon={DollarSign} label="Outstanding" value={`${data.stats.totalUnpaid.toLocaleString()} KWD`} href="/invoices" />
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Today Sales" value={`${data.kpis.salesToday.toFixed(3)} KWD`} icon={BarChart3} />
          <KpiCard label="This Month" value={`${data.kpis.salesThisMonth.toFixed(3)} KWD`} icon={BarChart3} />
          <KpiCard label="Outstanding" value={`${data.kpis.outstandingReceivables.toFixed(3)} KWD`} icon={DollarSign} />
          <KpiCard label="Inventory Value" value={`${data.kpis.inventoryValue.toFixed(3)} KWD`} icon={Package} />
          <KpiCard label="Low Stock Items" value={data.kpis.lowStockItems.toString()} icon={Package} />
          <KpiCard label="Overdue Customers" value={data.kpis.overdueCustomers.toString()} icon={Users} />
          <Link href="/reports" className="group relative rounded-lg border bg-background p-5 transition hover:shadow-sm">
            <div className="flex size-10 items-center justify-center rounded-md bg-muted">
              <BarChart3 className="size-5 text-primary" />
            </div>
            <p className="mt-4 text-sm font-medium text-muted-foreground">
              Reports &amp; Analytics <ArrowUpRight className="ml-1 inline size-3" />
            </p>
            <p className="mt-1 text-xs text-muted-foreground">View all reports</p>
          </Link>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-lg border">
            <div className="border-b px-5 py-4"><h2 className="text-sm font-semibold">Monthly Sales Trend</h2></div>
            <div className="p-4">
              {trend.length > 0 ? <TrendChart data={trend} /> : (
                <p className="py-8 text-center text-sm text-muted-foreground">No sales data yet.</p>
              )}
            </div>
          </section>
          <section className="rounded-lg border">
            <div className="border-b px-5 py-4"><h2 className="text-sm font-semibold">Top Products</h2></div>
            <div className="p-4">
              {topProducts.length > 0 ? <TopItemsChart data={topProducts} /> : (
                <p className="py-8 text-center text-sm text-muted-foreground">No product sales yet.</p>
              )}
            </div>
          </section>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <section className="rounded-lg border lg:col-span-2">
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
          <div className="space-y-6">
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
                          <p className="text-xs font-medium">{balance.toLocaleString()} KWD</p>
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
      </div>
    </AppShell>
  );
}

async function WelcomeDashboard({ orgId, orgName }: { orgId: string; orgName: string }) {
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
    { label: "Company", done: true, href: "/settings" },
    { label: "Warehouses", done: warehouseCount > 0, href: "/warehouses" },
    { label: "Products", done: productCount > 0, href: "/products" },
    { label: "Customers", done: customerCount > 0, href: "/customers" },
    { label: "Suppliers", done: supplierCount > 0, href: "/suppliers" },
    { label: "Sales Orders", done: soCount > 0, href: "/sales/orders" },
    { label: "Purchase Orders", done: poCount > 0, href: "/purchasing/orders" },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const isComplete = doneCount === steps.length;

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-8 py-8">
        <div className="text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10">
            <Building2 className="size-7 text-primary" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold">Welcome to WBOS</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {orgName} is ready. Complete the steps below to start operating.
          </p>
        </div>

        {isComplete ? (
          <div className="rounded-lg border bg-card p-6 text-center">
            <p className="font-medium">All setup steps complete</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Your organization is fully configured. The analytics dashboard will activate automatically.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Setup progress</span>
              <span className="font-medium">{doneCount}/{steps.length}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${(doneCount / steps.length) * 100}%` }}
              />
            </div>
          </div>
        )}

        <div className="space-y-1">
          {steps.map((step) => (
            <Link
              key={step.label}
              href={step.href}
              className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 text-sm transition hover:bg-muted/40"
            >
              <div
                className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  step.done
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {step.done ? "✓" : steps.indexOf(step) + 1}
              </div>
              <span className={step.done ? "text-muted-foreground line-through" : ""}>{step.label}</span>
              <ArrowUpRight className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </div>

        <div className="rounded-lg border bg-card p-5">
          <h2 className="text-sm font-semibold">Quick actions</h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {!warehouseCount ? <ActionCard icon={Building2} label="Create Warehouse" href="/warehouses" /> : null}
            {!productCount ? <ActionCard icon={Package} label="Create Product" href="/products" /> : null}
            {!customerCount ? <ActionCard icon={UserPlus} label="Create Customer" href="/customers" /> : null}
            {!supplierCount ? <ActionCard icon={Truck} label="Create Supplier" href="/suppliers" /> : null}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function ActionCard({ icon: Icon, label, href }: { icon: React.ComponentType<{ className?: string }>; label: string; href: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 rounded-md border bg-background px-3 py-2.5 text-sm font-medium transition hover:bg-muted"
    >
      <Icon className="size-4 text-muted-foreground" />
      {label}
    </Link>
  );
}

function StatCard({ icon: Icon, label, value, href }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number | string; href: string }) {
  return (
    <Link className="rounded-lg border bg-background p-5 transition hover:shadow-sm" href={href}>
      <div className="flex size-10 items-center justify-center rounded-md bg-muted">
        <Icon className="size-5 text-primary" />
      </div>
      <p className="mt-4 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
    </Link>
  );
}

function KpiCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background p-5">
      <div className="flex size-10 items-center justify-center rounded-md bg-muted">
        <Icon className="size-5 text-primary" />
      </div>
      <p className="mt-4 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
