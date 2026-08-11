import Link from "next/link";
import { ShoppingCart, User } from "lucide-react";
import { TopItemsChart } from "@/app/simple-bar-chart";
import type { SalesContextSummary } from "./executive-service";

const money = (v: number) =>
  v.toLocaleString("en-KW", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export function SalesContextPanel({ data }: { data: SalesContextSummary }) {
  const { averageOrderValue, totalOrders, topCustomers } = data;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground">Sales Performance</h2>
        <Link
          href="/reports/sales/by-customer"
          className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-none"
        >
          Full sales by customer report
        </Link>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border bg-background p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div className="flex size-10 items-center justify-center rounded-md bg-primary/10">
              <ShoppingCart className="size-5 text-primary" />
            </div>
          </div>
          <p className="mt-4 text-2xl font-semibold tracking-tight tabular-nums">{money(averageOrderValue)}</p>
          <p className="mt-1 text-sm text-muted-foreground">Average Order Value (KWD)</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{totalOrders.toLocaleString()} total orders</p>
        </div>

        <div className="rounded-lg border bg-background p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div className="flex size-10 items-center justify-center rounded-md bg-muted">
              <User className="size-5 text-muted-foreground" />
            </div>
          </div>
          <p className="mt-4 text-2xl font-semibold tracking-tight tabular-nums">
            {topCustomers.length > 0 ? money(topCustomers[0].value) : "—"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Top Customer Revenue (KWD)</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {topCustomers.length > 0 ? topCustomers[0].name : "No data"}
          </p>
        </div>
      </div>

      {/* Top customers chart */}
      <div className="rounded-lg border bg-background">
        <div className="border-b px-5 py-4">
          <h3 className="text-sm font-semibold">Top Customers by Revenue</h3>
        </div>
        <div className="p-4">
          {topCustomers.length > 0 ? (
            <TopItemsChart data={topCustomers} />
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">No customer data yet</p>
          )}
        </div>
      </div>
    </section>
  );
}
