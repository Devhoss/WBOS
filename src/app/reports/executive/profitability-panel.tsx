import Link from "next/link";
import { TrendingUp, DollarSign, Receipt } from "lucide-react";
import { TrendChart, TopItemsChart } from "@/app/simple-bar-chart";
import { cn } from "@/lib/utils";
import type { ProfitabilitySummary } from "./executive-service";

const money = (v: number) =>
  v.toLocaleString("en-KW", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export function ProfitabilityPanel({ data }: { data: ProfitabilitySummary }) {
  const { totalRevenue, totalCogs, grossProfit, grossMarginPercent, revenueTrend, topProducts } = data;

  const marginColor =
    grossMarginPercent >= 25
      ? "text-emerald-600 dark:text-emerald-400"
      : grossMarginPercent >= 15
        ? "text-amber-600 dark:text-amber-400"
        : "text-red-600 dark:text-red-400";

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground">Revenue &amp; Profitability</h2>
        <Link
          href="/reports/financial/gross-profit"
          className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-none"
        >
          Full gross profit report
        </Link>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border bg-background p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div className="flex size-10 items-center justify-center rounded-md bg-primary/10">
              <TrendingUp className="size-5 text-primary" />
            </div>
          </div>
          <p className="mt-4 text-2xl font-semibold tracking-tight tabular-nums">{money(totalRevenue)}</p>
          <p className="mt-1 text-sm text-muted-foreground">Total Revenue (KWD)</p>
        </div>

        <div className="rounded-lg border bg-background p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div className="flex size-10 items-center justify-center rounded-md bg-muted">
              <Receipt className="size-5 text-muted-foreground" />
            </div>
          </div>
          <p className="mt-4 text-2xl font-semibold tracking-tight tabular-nums">{money(totalCogs)}</p>
          <p className="mt-1 text-sm text-muted-foreground">Cost of Goods Sold (KWD)</p>
        </div>

        <div className="rounded-lg border bg-background p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div className="flex size-10 items-center justify-center rounded-md bg-primary/10">
              <DollarSign className="size-5 text-primary" />
            </div>
          </div>
          <p className={cn("mt-4 text-2xl font-semibold tracking-tight tabular-nums", marginColor)}>
            {money(grossProfit)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Gross Profit (KWD)</p>
          <p className={cn("mt-0.5 text-xs font-medium tabular-nums", marginColor)}>
            {grossMarginPercent.toFixed(1)}% margin
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border bg-background">
          <div className="border-b px-5 py-4">
            <h3 className="text-sm font-semibold">Revenue Trend</h3>
          </div>
          <div className="p-4">
            {revenueTrend.some((d) => d.value > 0) ? (
              <TrendChart data={revenueTrend} />
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">No revenue data yet</p>
            )}
          </div>
        </div>

        <div className="rounded-lg border bg-background">
          <div className="border-b px-5 py-4">
            <h3 className="text-sm font-semibold">Top Products by Revenue</h3>
          </div>
          <div className="p-4">
            {topProducts.length > 0 ? (
              <TopItemsChart data={topProducts} />
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">No product data yet</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
