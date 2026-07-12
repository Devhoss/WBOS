"use client";

import { Download } from "lucide-react";

import type { ReportColumn } from "@/domains/reports/dto/report-types";

type Props = {
  data: Record<string, unknown>[];
  filename: string;
  columns: ReportColumn[];
};

export function ExportButton({ data, filename, columns }: Props) {
  function handleExport() {
    const header = columns.map((c) => JSON.stringify(c.label)).join(",");
    const rows = data.map((row) =>
      columns.map((c) => {
        const val = row[c.key];
        const str = val == null ? "" : String(val);
        return JSON.stringify(str);
      }).join(","),
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition hover:bg-muted disabled:opacity-60"
      disabled={data.length === 0}
      onClick={handleExport}
      type="button"
    >
      <Download className="size-4" />
      Export CSV
    </button>
  );
}
