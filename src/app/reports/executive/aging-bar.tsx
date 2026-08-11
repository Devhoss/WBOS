import { cn } from "@/lib/utils";

type AgingBucket = {
  label: string;
  value: number;
  color: string;
};

type AgingBarProps = {
  buckets: AgingBucket[];
  total: number;
  className?: string;
};

const formatKwd = (v: number) =>
  v.toLocaleString("en-KW", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export function AgingBar({ buckets, total, className }: AgingBarProps) {
  if (total === 0) {
    return (
      <div className={cn("rounded-lg border bg-background p-4", className)}>
        <p className="text-sm text-muted-foreground">No outstanding balances</p>
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border bg-background p-4", className)}>
      <p className="mb-3 text-xs font-medium text-muted-foreground">Aging Distribution</p>

      {/* Stacked bar */}
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
        {buckets.map((bucket) => {
          const pct = (bucket.value / total) * 100;
          if (pct === 0) return null;
          return (
            <div
              key={bucket.label}
              className={cn("h-full transition-all", bucket.color)}
              style={{ width: `${pct}%` }}
              title={`${bucket.label}: ${formatKwd(bucket.value)}`}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        {buckets.map((bucket) => (
          <div key={bucket.label} className="flex items-center gap-1.5 text-xs">
            <span className={cn("inline-block size-2 rounded-full", bucket.color)} />
            <span className="text-muted-foreground">{bucket.label}</span>
            <span className="font-medium tabular-nums">{formatKwd(bucket.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
