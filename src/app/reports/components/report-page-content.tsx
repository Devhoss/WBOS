"use client";

import { useState, useCallback } from "react";
import type { ReportColumn, ReportFilters } from "@/domains/reports/dto/report-types";
import type { FilterValues } from "./report-filters";
import { ReportLayout } from "./report-layout";
import { ReportFilters as FilterBar } from "./report-filters";
import { ReportTable } from "./report-table";
import { ExportButton } from "./export-button";
import { PrintButton } from "./print-button";

type Props = {
  title: string;
  description?: string;
  columns: ReportColumn[];
  fetcher: (filters: ReportFilters) => Promise<Record<string, unknown>[]>;
  showWarehouse?: boolean;
  showCustomer?: boolean;
  showSupplier?: boolean;
  showSearch?: boolean;
};

function toReportFilters(fv: FilterValues): ReportFilters {
  return {
    dateRange: {
      from: fv.dateFrom ? new Date(fv.dateFrom) : null,
      to: fv.dateTo ? new Date(fv.dateTo) : null,
    },
    warehouseId: fv.warehouseId || null,
    customerId: fv.customerId || null,
    supplierId: fv.supplierId || null,
    search: fv.search || "",
  };
}

export function ReportPageContent({
  title, description, columns, fetcher,
  showWarehouse, showCustomer, showSupplier, showSearch,
}: Props) {
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);

  const handleFiltersChange = useCallback(async (fv: FilterValues) => {
    setLoading(true);
    try {
      const result = await fetcher(toReportFilters(fv));
      setData(result);
    } finally {
      setLoading(false);
    }
  }, [fetcher]);

  return (
    <ReportLayout
      title={title}
      description={description}
      actions={
        <div className="flex gap-2">
          <ExportButton data={data} columns={columns} filename={title.toLowerCase().replace(/\s+/g, "-")} />
          <PrintButton />
        </div>
      }
    >
      <FilterBar
        onFiltersChange={handleFiltersChange}
        showWarehouse={showWarehouse}
        showCustomer={showCustomer}
        showSupplier={showSupplier}
        showSearch={showSearch}
      />
      <div className="mt-4">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">Loading...</div>
        ) : (
          <ReportTable columns={columns} rows={data} />
        )}
      </div>
    </ReportLayout>
  );
}
