import { AppShell } from "@/components/app-shell";
import { ReportPageContent } from "../../components/report-page-content";
import { getOutstandingBalances } from "@/domains/reports/services/report-actions";
import type { ReportColumn } from "@/domains/reports/dto/report-types";

const columns: ReportColumn[] = [
  { key: "customerName", label: "Customer Name", align: "left", format: "string" },
  { key: "totalInvoiced", label: "Total Invoiced", align: "right", format: "currency" },
  { key: "totalPaid", label: "Total Paid", align: "right", format: "currency" },
  { key: "outstanding", label: "Outstanding", align: "right", format: "currency" },
];

export default function Page() {
  return (
    <AppShell>
      <ReportPageContent
        title="Outstanding Balances"
        description="All unpaid customer invoices and credits"
        columns={columns}
        fetcher={getOutstandingBalances}
        showWarehouse={false}
        showCustomer={false}
        showSupplier={false}
        showSearch={false}
      />
    </AppShell>
  );
}
