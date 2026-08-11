import type { TopItem, TrendPoint } from "./dashboard-service";

function formatKwd(v: number): string {
  return v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatKwdShort(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return formatKwd(v);
}

export function TrendChart({ data }: { data: TrendPoint[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const avg = data.reduce((sum, d) => sum + d.value, 0) / data.length;
  const w = 640;
  const h = 200;
  const pad = { t: 20, r: 10, b: 30, l: 10 };
  const cw = w - pad.l - pad.r;
  const ch = h - pad.t - pad.b;
  const gap = 8;
  const barW = Math.max(4, (cw - gap * (data.length - 1)) / data.length);

  const avgY = avg > 0 ? pad.t + ch - (avg / max) * ch : pad.t + ch;
  const tableId = "trend-data-table";

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full max-w-full"
        style={{ minWidth: w }}
        role="img"
        aria-label="Monthly sales trend chart"
        aria-describedby={tableId}
      >
        <title>Monthly Sales Trend</title>
        <desc>A bar chart showing sales totals for the last 6 months with average line.</desc>

        {/* Average line */}
        {avg > 0 && (
          <g>
            <line
              x1={pad.l}
              y1={avgY}
              x2={pad.l + cw}
              y2={avgY}
              className="stroke-muted-foreground/40"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            <text
              x={pad.l + cw}
              y={avgY - 4}
              textAnchor="end"
              className="fill-muted-foreground text-[9px]"
            >
              avg
            </text>
          </g>
        )}

        {data.map((d, i) => {
          const bh = d.value > 0 ? Math.max(2, (d.value / max) * ch) : 0;
          const x = pad.l + i * (barW + gap);
          const y = pad.t + ch - bh;
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={bh} rx={3} className="fill-primary" />
              <text x={x + barW / 2} y={pad.t + ch + 16} textAnchor="middle" className="fill-muted-foreground text-[10px]">
                {d.label}
              </text>
              {d.value > 0 && (
                <text x={x + barW / 2} y={y - 4} textAnchor="middle" className="fill-foreground text-[10px] font-medium">
                  {formatKwdShort(d.value)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <table id={tableId} className="sr-only">
        <caption>Monthly sales trend data</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Sales (KWD)</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <td>{d.label}</td>
              <td>{formatKwd(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TopItemsChart({ data, maxLabelLen = 18 }: { data: TopItem[]; maxLabelLen?: number }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const h = 28 * data.length + 8;
  const w = 480;
  const pad = { t: 4, r: 60, b: 4, l: 120 };
  const cw = w - pad.l - pad.r;
  const tableId = "top-items-data-table";

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full max-w-full"
        style={{ minWidth: w }}
        role="img"
        aria-label="Top products chart"
        aria-describedby={tableId}
      >
        <title>Top Products</title>
        <desc>A horizontal bar chart showing the top products by sales revenue.</desc>
        {data.map((d, i) => {
          const bw = d.value > 0 ? Math.max(4, (d.value / max) * cw) : 0;
          const y = pad.t + i * 28;
          const label = d.name.length > maxLabelLen ? d.name.slice(0, maxLabelLen) + "…" : d.name;
          const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
          return (
            <g key={i}>
              <text x={pad.l - 6} y={y + 18} textAnchor="end" className="fill-foreground text-[11px] leading-4">
                {label}
              </text>
              <rect x={pad.l} y={y + 4} width={bw} height={20} rx={3} className="fill-primary" />
              <text x={pad.l + bw + 6} y={y + 14} className="fill-foreground text-[10px] font-medium">
                {formatKwdShort(d.value)}
              </text>
              <text x={pad.l + bw + 6} y={y + 23} className="fill-muted-foreground text-[9px]">
                {pct}%
              </text>
            </g>
          );
        })}
      </svg>
      <table id={tableId} className="sr-only">
        <caption>Top products by sales revenue</caption>
        <thead>
          <tr>
            <th scope="col">Product</th>
            <th scope="col">Sales (KWD)</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.name}>
              <td>{d.name}</td>
              <td>{formatKwd(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
