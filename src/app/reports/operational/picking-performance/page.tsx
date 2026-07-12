import { AppShell } from "@/components/app-shell";
import { ReportPageContent } from "../../components/report-page-content";
import { getPickingPerformance } from "@/domains/reports/services/report-actions";
import type { ReportColumn } from "@/domains/reports/dto/report-types";

const columns: ReportColumn[] = [
  { key: "period", label: "Period", align: "left", format: "string" },
  { key: "totalOrders", label: "Total Orders", align: "right", format: "number" },
  { key: "itemsPicked", label: "Items Picked", align: "right", format: "number" },
  { key: "accuracy", label: "Accuracy (%)", align: "right", format: "number" },
  { key: "avgPickTime", label: "Avg Pick Time", align: "right", format: "string" },
];

export default function Page() {
  return (
    <AppShell>
      <ReportPageContent
        title="Picking Performance"
        description="Picker productivity and accuracy metrics"
        columns={columns}
        fetcher={getPickingPerformance}
        showWarehouse={true}
        showCustomer={false}
        showSupplier={false}
        showSearch={false}
      />
    </AppShell>
  );
}
