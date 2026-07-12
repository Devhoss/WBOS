import { AppShell } from "@/components/app-shell";
import { ReportPageContent } from "../../components/report-page-content";
import { getTopCustomers } from "@/domains/reports/services/report-actions";
import type { ReportColumn } from "@/domains/reports/dto/report-types";

const columns: ReportColumn[] = [
  { key: "customerName", label: "Customer Name", align: "left", format: "string" },
  { key: "orderCount", label: "Order Count", align: "right", format: "number" },
  { key: "totalAmount", label: "Total Sales", align: "right", format: "currency" },
];

export default function Page() {
  return (
    <AppShell>
      <ReportPageContent
        title="Top Customers"
        description="Customers ranked by total spend and frequency"
        columns={columns}
        fetcher={getTopCustomers}
        showWarehouse={false}
        showCustomer={false}
        showSupplier={false}
        showSearch={true}
      />
    </AppShell>
  );
}
