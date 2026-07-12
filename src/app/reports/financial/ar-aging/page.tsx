import { AppShell } from "@/components/app-shell";
import { ReportPageContent } from "../../components/report-page-content";
import { getArAging } from "@/domains/reports/services/report-actions";
import type { ReportColumn } from "@/domains/reports/dto/report-types";

const columns: ReportColumn[] = [
  { key: "customerName", label: "Customer Name", align: "left", format: "string" },
  { key: "current", label: "Current", align: "right", format: "currency" },
  { key: "days1to30", label: "1-30 Days", align: "right", format: "currency" },
  { key: "days31to60", label: "31-60 Days", align: "right", format: "currency" },
  { key: "days61to90", label: "61-90 Days", align: "right", format: "currency" },
  { key: "days91plus", label: "90+ Days", align: "right", format: "currency" },
  { key: "totalOutstanding", label: "Total Outstanding", align: "right", format: "currency" },
];

export default function Page() {
  return (
    <AppShell>
      <ReportPageContent
        title="A/R Aging"
        description="Receivables categorized by age brackets"
        columns={columns}
        fetcher={getArAging}
        showWarehouse={false}
        showCustomer={true}
        showSupplier={false}
        showSearch={true}
      />
    </AppShell>
  );
}
