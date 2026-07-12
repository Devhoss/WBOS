export type DateRange = {
  from: Date | null;
  to: Date | null;
};

export type ReportFilters = {
  dateRange: DateRange;
  warehouseId: string | null;
  customerId: string | null;
  supplierId: string | null;
  search: string;
};

export type ReportColumn = {
  key: string;
  label: string;
  align?: "left" | "center" | "right";
  format?: "number" | "currency" | "date" | "string";
  sortable?: boolean;
};

export type ReportMeta = {
  totalRows: number;
  generatedAt: string;
  dateRange: DateRange;
};

export type KpiCard = {
  label: string;
  value: string;
  subtitle?: string;
  trend?: { direction: "up" | "down" | "neutral"; percent: string };
  icon?: string;
};

export type ReportData<T> = {
  rows: T[];
  meta: ReportMeta;
};
