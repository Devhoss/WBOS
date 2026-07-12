import { AppShell } from "@/components/app-shell";
import { ReportPageContent } from "../../components/report-page-content";
import { getDeliveryPerformance } from "@/domains/reports/services/report-actions";
import type { ReportColumn } from "@/domains/reports/dto/report-types";

const columns: ReportColumn[] = [
  { key: "period", label: "Period", align: "left", format: "string" },
  { key: "totalDeliveries", label: "Total Deliveries", align: "right", format: "number" },
  { key: "onTime", label: "On-Time", align: "right", format: "number" },
  { key: "late", label: "Late", align: "right", format: "number" },
  { key: "onTimeRate", label: "On-Time Rate (%)", align: "right", format: "number" },
  { key: "avgDeliveryTime", label: "Avg Delivery Time", align: "right", format: "string" },
];

export default function Page() {
  return (
    <AppShell>
      <ReportPageContent
        title="Delivery Performance"
        description="On-time delivery metrics and carrier performance"
        columns={columns}
        fetcher={getDeliveryPerformance}
        showWarehouse={true}
        showCustomer={false}
        showSupplier={false}
        showSearch={false}
      />
    </AppShell>
  );
}
