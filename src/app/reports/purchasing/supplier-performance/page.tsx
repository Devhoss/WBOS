import { AppShell } from "@/components/app-shell";
import { ReportPageContent } from "../../components/report-page-content";
import { getSupplierPerformance } from "@/domains/reports/services/report-actions";
import type { ReportColumn } from "@/domains/reports/dto/report-types";

const columns: ReportColumn[] = [
  { key: "supplierName", label: "Supplier", align: "left", format: "string" },
  { key: "orderCount", label: "PO Count", align: "right", format: "number" },
  { key: "averageLeadTimeDays", label: "Avg Lead Time (days)", align: "right", format: "number" },
  { key: "onTimeDeliveryRate", label: "On-Time Rate (%)", align: "right", format: "number" },
];

export default function Page() {
  return (
    <AppShell>
      <ReportPageContent
        title="Supplier Performance"
        description="On-time delivery and quality metrics by supplier"
        columns={columns}
        fetcher={getSupplierPerformance}
        showWarehouse={false}
        showCustomer={false}
        showSupplier={true}
        showSearch={false}
      />
    </AppShell>
  );
}
