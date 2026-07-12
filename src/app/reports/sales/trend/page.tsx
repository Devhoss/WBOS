import { AppShell } from "@/components/app-shell";
import { ReportPageContent } from "../../components/report-page-content";
import { getSalesTrend } from "@/domains/reports/services/report-actions";
import type { ReportColumn } from "@/domains/reports/dto/report-types";

const columns: ReportColumn[] = [
  { key: "period", label: "Date", align: "left", format: "date" },
  { key: "orderCount", label: "Order Count", align: "right", format: "number" },
  { key: "totalAmount", label: "Total Sales", align: "right", format: "currency" },
];

export default function Page() {
  return (
    <AppShell>
      <ReportPageContent
        title="Sales Trend"
        description="Daily, weekly, and monthly sales trends over time"
        columns={columns}
        fetcher={getSalesTrend}
        showWarehouse={false}
        showCustomer={false}
        showSupplier={false}
        showSearch={false}
      />
    </AppShell>
  );
}
