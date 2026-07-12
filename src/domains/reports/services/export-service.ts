export class ExportService {
  toCsv<T extends Record<string, unknown>>(rows: T[], columns: { key: string; label: string }[]): string {
    const header = columns.map((c) => this.escapeCsvField(c.label)).join(",");

    const body = rows.map((row) =>
      columns.map((c) => this.escapeCsvField(String(row[c.key] ?? ""))).join(","),
    );

    return [header, ...body].join("\n");
  }

  toCsvBlob(csvString: string): Blob {
    return new Blob([csvString], { type: "text/csv;charset=utf-8;" });
  }

  downloadFilename(reportName: string): string {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const sanitized = reportName.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
    return `${sanitized}_${timestamp}.csv`;
  }

  private escapeCsvField(value: string): string {
    if (value.includes(",") || value.includes('"') || value.includes("\n") || value.includes("\r")) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
