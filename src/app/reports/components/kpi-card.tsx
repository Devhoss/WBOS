import { TrendingDown, TrendingUp } from "lucide-react";

import { cn } from "@/lib/utils";

type KpiCardProps = {
  label: string;
  value: string;
  subtitle?: string;
  trend?: { direction: "up" | "down"; value: string };
  icon?: React.ReactNode;
};

export function KpiCard({ label, value, subtitle, trend, icon }: KpiCardProps) {
  return (
    <div className="rounded-lg border bg-card p-5 text-card-foreground shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 truncate text-2xl font-semibold tracking-tight">{value}</p>
          {subtitle ? (
            <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
          ) : null}
          {trend ? (
            <div className="mt-2 flex items-center gap-1 text-xs">
              {trend.direction === "up" ? (
                <TrendingUp className="size-3.5 text-emerald-600" />
              ) : (
                <TrendingDown className="size-3.5 text-red-600" />
              )}
              <span className={cn(
                "font-medium",
                trend.direction === "up" ? "text-emerald-600" : "text-red-600",
              )}>
                {trend.value}
              </span>
            </div>
          ) : null}
        </div>
        {icon ? (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            {icon}
          </div>
        ) : null}
      </div>
    </div>
  );
}
