import { AppShell } from "@/components/app-shell";
import { ReportPageContent } from "../../components/report-page-content";
import { getGrossProfit } from "@/domains/reports/services/report-actions";
import type { ReportColumn } from "@/domains/reports/dto/report-types";

const columns: ReportColumn[] = [
  { key: "issuedAt", label: "Date", align: "left", format: "date" },
  { key: "invoiceNumber", label: "Invoice", align: "left", format: "string" },
  { key: "customerName", label: "Customer", align: "left", format: "string" },
  { key: "productName", label: "Product", align: "left", format: "string" },
  { key: "revenue", label: "Revenue", align: "right", format: "currency" },
  { key: "cogs", label: "COGS", align: "right", format: "currency" },
  { key: "grossProfit", label: "Gross Profit", align: "right", format: "currency" },
  { key: "marginPercent", label: "Margin %", align: "right", format: "number" },
];

export default function Page() {
  return (
    <AppShell>
      <ReportPageContent
        title="Gross Profit"
        description="Per-invoice revenue vs COGS with calculated margin"
        columns={columns}
        fetcher={getGrossProfit}
        showWarehouse={false}
        showCustomer={false}
        showSupplier={false}
        showSearch={false}
      />
    </AppShell>
  );
}
