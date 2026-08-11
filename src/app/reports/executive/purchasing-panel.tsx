import Link from "next/link";
import { ShoppingCart, PackageOpen, Banknote } from "lucide-react";
import { statusColorClass, formatStatus } from "@/components/status-colors";
import { cn } from "@/lib/utils";
import type { PurchasingSummary } from "./executive-service";

const money = (v: number) =>
  v.toLocaleString("en-KW", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export function PurchasingPanel({ data }: { data: PurchasingSummary }) {
  const { totalSpend, openPoCount, outstandingValue, topSuppliers, openPos } = data;

  const maxSupplierSpend = Math.max(...topSuppliers.map((s) => s.totalAmount), 1);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground">Purchasing</h2>
        <Link
          href="/reports/purchasing/by-supplier"
          className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-none"
        >
          Full purchasing report
        </Link>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border bg-background p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div className="flex size-10 items-center justify-center rounded-md bg-primary/10">
              <ShoppingCart className="size-5 text-primary" />
            </div>
          </div>
          <p className="mt-4 text-2xl font-semibold tracking-tight tabular-nums">{money(totalSpend)}</p>
          <p className="mt-1 text-sm text-muted-foreground">Total PO Spend (KWD)</p>
        </div>

        <div className="rounded-lg border bg-background p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div className="flex size-10 items-center justify-center rounded-md bg-muted">
              <PackageOpen className="size-5 text-muted-foreground" />
            </div>
          </div>
          <p className="mt-4 text-2xl font-semibold tracking-tight tabular-nums">{openPoCount}</p>
          <p className="mt-1 text-sm text-muted-foreground">Open Purchase Orders</p>
        </div>

        <div className="rounded-lg border bg-background p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div className="flex size-10 items-center justify-center rounded-md bg-muted">
              <Banknote className="size-5 text-muted-foreground" />
            </div>
          </div>
          <p className="mt-4 text-2xl font-semibold tracking-tight tabular-nums">{money(outstandingValue)}</p>
          <p className="mt-1 text-sm text-muted-foreground">Outstanding PO Value (KWD)</p>
        </div>
      </div>

      {/* Charts + table */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top suppliers bar chart */}
        <div className="rounded-lg border bg-background">
          <div className="border-b px-5 py-4">
            <h3 className="text-sm font-semibold">Top Suppliers by Spend</h3>
          </div>
          <div className="p-4">
            {topSuppliers.length > 0 ? (
              <div className="space-y-3">
                {topSuppliers.map((supplier) => (
                  <div key={supplier.name} className="flex items-center gap-3">
                    <span className="w-32 truncate text-xs text-muted-foreground" title={supplier.name}>
                      {supplier.name}
                    </span>
                    <div className="flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-primary"
                        style={{ width: `${(supplier.totalAmount / maxSupplierSpend) * 100}%` }}
                      />
                    </div>
                    <span className="w-24 text-right text-xs font-medium tabular-nums">
                      {money(supplier.totalAmount)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">No purchase data yet</p>
            )}
          </div>
        </div>

        {/* Open POs table */}
        <div className="rounded-lg border bg-background">
          <div className="border-b px-5 py-4">
            <h3 className="text-sm font-semibold">Open Purchase Orders</h3>
          </div>
          {openPos.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                    <th className="px-5 py-3">PO</th>
                    <th className="px-5 py-3">Supplier</th>
                    <th className="px-5 py-3 text-right">Outstanding</th>
                    <th className="px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {openPos.map((po) => (
                    <tr key={po.poNumber} className="border-b last:border-0">
                      <td className="px-5 py-3 font-medium">{po.poNumber}</td>
                      <td className="px-5 py-3">{po.supplierName}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{money(po.outstandingValue)}</td>
                      <td className="px-5 py-3">
                        <span className={cn("inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase", statusColorClass(po.status))}>
                          {formatStatus(po.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">No open purchase orders</p>
          )}
        </div>
      </div>
    </section>
  );
}
