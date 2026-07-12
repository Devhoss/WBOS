import type { TopItem, TrendPoint } from "./dashboard-service";

function formatKwd(v: number): string {
  return v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function TrendChart({ data }: { data: TrendPoint[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const w = 640;
  const h = 200;
  const pad = { t: 10, r: 10, b: 30, l: 10 };
  const cw = w - pad.l - pad.r;
  const ch = h - pad.t - pad.b;
  const gap = 8;
  const barW = Math.max(4, (cw - gap * (data.length - 1)) / data.length);

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-full" style={{ minWidth: w }}>
        {data.map((d, i) => {
          const bh = d.value > 0 ? Math.max(2, (d.value / max) * ch) : 0;
          const x = pad.l + i * (barW + gap);
          const y = pad.t + ch - bh;
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={bh} rx={3} className="fill-primary/80" />
              <text x={x + barW / 2} y={pad.t + ch + 16} textAnchor="middle" className="fill-muted-foreground text-[10px]">
                {d.label}
              </text>
              {bh > 20 && (
                <text x={x + barW / 2} y={y - 4} textAnchor="middle" className="fill-foreground text-[10px] font-medium">
                  {formatKwd(d.value)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function TopItemsChart({ data, maxLabelLen = 18 }: { data: TopItem[]; maxLabelLen?: number }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const h = 28 * data.length + 8;
  const w = 480;
  const pad = { t: 4, r: 60, b: 4, l: 120 };
  const cw = w - pad.l - pad.r;

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-full" style={{ minWidth: w }}>
        {data.map((d, i) => {
          const bw = d.value > 0 ? Math.max(4, (d.value / max) * cw) : 0;
          const y = pad.t + i * 28;
          const label = d.name.length > maxLabelLen ? d.name.slice(0, maxLabelLen) + "…" : d.name;
          return (
            <g key={i}>
              <text x={pad.l - 6} y={y + 18} textAnchor="end" className="fill-foreground text-[11px] leading-4">
                {label}
              </text>
              <rect x={pad.l} y={y + 4} width={bw} height={20} rx={3} className="fill-primary/80" />
              <text x={pad.l + bw + 6} y={y + 18} className="fill-foreground text-[11px] font-medium">
                {formatKwd(d.value)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
