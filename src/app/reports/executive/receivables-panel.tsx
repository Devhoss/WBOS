import Link from "next/link";
import { DollarSign, Users } from "lucide-react";
import { AgingBar } from "./aging-bar";
import type { ReceivablesSummary } from "./executive-service";

const money = (v: number) =>
  v.toLocaleString("en-KW", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export function ReceivablesPanel({ data }: { data: ReceivablesSummary }) {
  const { totalOutstanding, overdueCount, aging, topOverdueCustomers } = data;

  const agingBuckets = [
    { label: "Current", value: aging.current, color: "bg-blue-400 dark:bg-blue-500" },
    { label: "1–30 days", value: aging.days1to30, color: "bg-amber-400 dark:bg-amber-500" },
    { label: "31–60 days", value: aging.days31to60, color: "bg-orange-400 dark:bg-orange-500" },
    { label: "61–90 days", value: aging.days61to90, color: "bg-red-400 dark:bg-red-500" },
    { label: "90+ days", value: aging.days91plus, color: "bg-red-600 dark:bg-red-700" },
  ];

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground">Receivables</h2>
        <Link
          href="/reports/financial/ar-aging"
          className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-none"
        >
          Full A/R aging report
        </Link>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border bg-background p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div className="flex size-10 items-center justify-center rounded-md bg-primary/10">
              <DollarSign className="size-5 text-primary" />
            </div>
          </div>
          <p className="mt-4 text-2xl font-semibold tracking-tight tabular-nums">{money(totalOutstanding)}</p>
          <p className="mt-1 text-sm text-muted-foreground">Total Outstanding (KWD)</p>
        </div>

        <div className="rounded-lg border bg-background p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div className="flex size-10 items-center justify-center rounded-md bg-muted">
              <Users className="size-5 text-muted-foreground" />
            </div>
          </div>
          <p className="mt-4 text-2xl font-semibold tracking-tight tabular-nums">{overdueCount}</p>
          <p className="mt-1 text-sm text-muted-foreground">Overdue Customers</p>
        </div>
      </div>

      {/* Aging bar */}
      <AgingBar buckets={agingBuckets} total={totalOutstanding} />

      {/* Overdue customers table */}
      {topOverdueCustomers.length > 0 && (
        <div className="rounded-lg border bg-background">
          <div className="border-b px-5 py-4">
            <h3 className="text-sm font-semibold">Overdue by Customer</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3 text-right">Current</th>
                  <th className="px-5 py-3 text-right">1–30d</th>
                  <th className="px-5 py-3 text-right">31–60d</th>
                  <th className="px-5 py-3 text-right">61–90d</th>
                  <th className="px-5 py-3 text-right">90+d</th>
                  <th className="px-5 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {topOverdueCustomers.map((c) => (
                  <tr key={c.name} className="border-b last:border-0">
                    <td className="px-5 py-3 font-medium">{c.name}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{c.current > 0 ? money(c.current) : "—"}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{c.days1to30 > 0 ? money(c.days1to30) : "—"}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{c.days31to60 > 0 ? money(c.days31to60) : "—"}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{c.days61to90 > 0 ? money(c.days61to90) : "—"}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{c.days91plus > 0 ? money(c.days91plus) : "—"}</td>
                    <td className="px-5 py-3 text-right font-medium tabular-nums">{money(c.totalOutstanding)}</td>
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
