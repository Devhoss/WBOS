import type { ReportColumn } from "@/domains/reports/dto/report-types";
import { cn } from "@/lib/utils";

type Props = {
  columns: ReportColumn[];
  rows: Record<string, unknown>[];
};

function formatValue(value: unknown, format?: ReportColumn["format"]): string {
  if (value == null) return "-";
  if (format === "currency") {
    const n = Number(value);
    return Number.isNaN(n) ? String(value) : n.toFixed(3);
  }
  if (format === "number") {
    const n = Number(value);
    return Number.isNaN(n) ? String(value) : n.toLocaleString();
  }
  if (format === "date") {
    const d = new Date(String(value));
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString();
  }
  return String(value);
}

export function ReportTable({ columns, rows }: Props) {
  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "h-10 px-4 text-xs font-semibold uppercase text-muted-foreground",
                    col.align === "right" && "text-right",
                    col.align === "center" && "text-center",
                  )}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  className="h-32 px-4 text-center text-sm text-muted-foreground"
                  colSpan={columns.length}
                >
                  No data found
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={i} className="border-b last:border-b-0 hover:bg-muted/30">
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        "h-12 px-4 text-sm",
                        col.align === "right" && "text-right font-mono tabular-nums",
                        col.align === "center" && "text-center",
                      )}
                    >
                      {formatValue(row[col.key], col.format)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center border-t px-4 py-2.5 text-xs text-muted-foreground">
        <span>{rows.length} row{rows.length !== 1 ? "s" : ""}</span>
      </div>
    </div>
  );
}
