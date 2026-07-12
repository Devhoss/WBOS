import { AppShell } from "@/components/app-shell";
import { ReportPageContent } from "../../components/report-page-content";
import { getCashCollection } from "@/domains/reports/services/report-actions";
import type { ReportColumn } from "@/domains/reports/dto/report-types";

const columns: ReportColumn[] = [
  { key: "date", label: "Date", align: "left", format: "date" },
  { key: "method", label: "Method", align: "left", format: "string" },
  { key: "totalAmount", label: "Amount", align: "right", format: "currency" },
  { key: "paymentCount", label: "Payment Count", align: "right", format: "number" },
];

export default function Page() {
  return (
    <AppShell>
      <ReportPageContent
        title="Cash Collection"
        description="Cash inflow tracking from customer payments"
        columns={columns}
        fetcher={getCashCollection}
        showWarehouse={false}
        showCustomer={false}
        showSupplier={false}
        showSearch={false}
      />
    </AppShell>
  );
}
