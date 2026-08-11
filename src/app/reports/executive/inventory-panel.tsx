import Link from "next/link";
import { Coins, Package, Clock } from "lucide-react";
import { AgingBar } from "./aging-bar";
import type { InventorySummary } from "./executive-service";

const money = (v: number) =>
  v.toLocaleString("en-KW", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export function InventoryPanel({ data }: { data: InventorySummary }) {
  const { totalValue, lowStockCount, slowMovingCount, aging, topSlowMoving } = data;

  const totalAgingItems = aging.bucket0to30 + aging.bucket31to60 + aging.bucket61to90 + aging.bucket91plus;

  const agingBuckets = [
    { label: "0–30 days", value: aging.bucket0to30, color: "bg-emerald-400 dark:bg-emerald-500" },
    { label: "31–60 days", value: aging.bucket31to60, color: "bg-amber-400 dark:bg-amber-500" },
    { label: "61–90 days", value: aging.bucket61to90, color: "bg-orange-400 dark:bg-orange-500" },
    { label: "90+ days", value: aging.bucket91plus, color: "bg-red-400 dark:bg-red-500" },
  ];

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground">Inventory</h2>
        <Link
          href="/reports/inventory/valuation"
          className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-none"
        >
          Full valuation report
        </Link>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border bg-background p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div className="flex size-10 items-center justify-center rounded-md bg-primary/10">
              <Coins className="size-5 text-primary" />
            </div>
          </div>
          <p className="mt-4 text-2xl font-semibold tracking-tight tabular-nums text-primary">
            {money(totalValue)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Total Inventory Value (KWD)</p>
        </div>

        <div className="rounded-lg border bg-background p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div className="flex size-10 items-center justify-center rounded-md bg-muted">
              <Package className="size-5 text-muted-foreground" />
            </div>
          </div>
          <p className="mt-4 text-2xl font-semibold tracking-tight tabular-nums">{lowStockCount}</p>
          <p className="mt-1 text-sm text-muted-foreground">Low Stock Items</p>
        </div>

        <div className="rounded-lg border bg-background p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div className="flex size-10 items-center justify-center rounded-md bg-muted">
              <Clock className="size-5 text-muted-foreground" />
            </div>
          </div>
          <p className="mt-4 text-2xl font-semibold tracking-tight tabular-nums">{slowMovingCount}</p>
          <p className="mt-1 text-sm text-muted-foreground">Slow-Moving Items</p>
          <p className="mt-0.5 text-xs text-muted-foreground">No movement in 90 days</p>
        </div>
      </div>

      {/* Aging bar */}
      <AgingBar buckets={agingBuckets} total={totalAgingItems} />

      {/* Slow-moving items table */}
      {topSlowMoving.length > 0 && (
        <div className="rounded-lg border bg-background">
          <div className="border-b px-5 py-4">
            <h3 className="text-sm font-semibold">Slow-Moving Items (Top 10)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                  <th className="px-5 py-3">Product</th>
                  <th className="px-5 py-3 text-right">On Hand</th>
                  <th className="px-5 py-3 text-right">Movement (90d)</th>
                </tr>
              </thead>
              <tbody>
                {topSlowMoving.map((item) => (
                  <tr key={item.name} className="border-b last:border-0">
                    <td className="px-5 py-3 font-medium">{item.name}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{item.onHand.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">
                      {item.movementInPeriod.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
