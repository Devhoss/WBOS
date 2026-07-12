import { AppShell } from "@/components/app-shell";
import { ReportPageContent } from "../../components/report-page-content";
import { getAverageOrderValue } from "@/domains/reports/services/report-actions";
import type { ReportColumn } from "@/domains/reports/dto/report-types";

const columns: ReportColumn[] = [
  { key: "totalOrders", label: "Order Count", align: "right", format: "number" },
  { key: "totalRevenue", label: "Total Sales", align: "right", format: "currency" },
  { key: "averageOrderValue", label: "Avg Order Value", align: "right", format: "currency" },
];

export default function Page() {
  return (
    <AppShell>
      <ReportPageContent
        title="Average Order Value"
        description="Average transaction value over selected period"
        columns={columns}
        fetcher={getAverageOrderValue}
        showWarehouse={false}
        showCustomer={true}
        showSupplier={false}
        showSearch={false}
      />
    </AppShell>
  );
}
