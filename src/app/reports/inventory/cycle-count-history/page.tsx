import { AppShell } from "@/components/app-shell";
import { ReportPageContent } from "../../components/report-page-content";
import { getCycleCountHistory } from "@/domains/reports/services/report-actions";
import type { ReportColumn } from "@/domains/reports/dto/report-types";

const columns: ReportColumn[] = [
  { key: "countNumber", label: "Count Number", align: "left", format: "string" },
  { key: "warehouseName", label: "Warehouse", align: "left", format: "string" },
  { key: "status", label: "Status", align: "left", format: "string" },
  { key: "countedBy", label: "Counted By", align: "left", format: "string" },
  { key: "countedAt", label: "Count Date", align: "left", format: "date" },
  { key: "countedItems", label: "Items Counted", align: "right", format: "number" },
  { key: "varianceItems", label: "Discrepancies", align: "right", format: "number" },
];

export default function Page() {
  return (
    <AppShell>
      <ReportPageContent
        title="Cycle Count History"
        description="Physical count records and adjustment logs"
        columns={columns}
        fetcher={getCycleCountHistory}
        showWarehouse={true}
        showCustomer={false}
        showSupplier={false}
        showSearch={false}
      />
    </AppShell>
  );
}
