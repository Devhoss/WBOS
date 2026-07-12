import { AppShell } from "@/components/app-shell";
import { ReportPageContent } from "../../components/report-page-content";
import { getWarehouseActivity } from "@/domains/reports/services/report-actions";
import type { ReportColumn } from "@/domains/reports/dto/report-types";

const columns: ReportColumn[] = [
  { key: "warehouse", label: "Warehouse", align: "left", format: "string" },
  { key: "receipts", label: "Receipts", align: "right", format: "number" },
  { key: "shipments", label: "Shipments", align: "right", format: "number" },
  { key: "transfers", label: "Transfers", align: "right", format: "number" },
  { key: "adjustments", label: "Adjustments", align: "right", format: "number" },
  { key: "totalTransactions", label: "Total Transactions", align: "right", format: "number" },
];

export default function Page() {
  return (
    <AppShell>
      <ReportPageContent
        title="Warehouse Activity"
        description="Overall operations summary per warehouse zone"
        columns={columns}
        fetcher={getWarehouseActivity}
        showWarehouse={true}
        showCustomer={false}
        showSupplier={false}
        showSearch={false}
      />
    </AppShell>
  );
}
